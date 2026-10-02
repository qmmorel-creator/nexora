-- Nexora · Réglages Budget (#574) — renommage et couleur des catégories et
-- sous-catégories KDM360, en UNE transaction Postgres.
--
-- Complète `finance_admin_reference_write` (création, budget mensuel,
-- activation, suppression refusée si utilisée), qui ne sait ni renommer ni
-- changer la couleur. Le nom d'une catégorie est sa clé, et
-- `finance_transactions_current.category` est un texte libre SANS clé
-- étrangère : renommer le seul référentiel laisserait les transactions sur
-- l'ancien nom. Ici, tout ce qui porte le nom suit, ou rien ne change :
--   - finance_categories_current (clé) → finance_subcategories_current et
--     finance_category_budgets suivent par ON UPDATE CASCADE ;
--   - finance_transactions_current : colonne, case `raw` (8 = catégorie,
--     9 = sous-catégorie, comme finance_apply_transaction_write), révision + 1,
--     et une entrée `update` par transaction dans finance_write_outbox ;
--   - finance_merchant_rules et finance_recurring_rules (sans clé étrangère).
-- Une ligne de finance_reference_audit trace l'opération (action `rename`
-- ou `style`), clé d'idempotence comprise : rejouer la même clé ne refait rien.
--
-- Noms protégés (lus par les calculs de Nexora : Sankey,
-- agrégats) : « Épargne », « Transferts internes », « Ajustement ». On peut
-- changer leur couleur, pas leur nom, ni donner leur nom à une autre catégorie.
--
-- Droits : comme les autres fonctions d'administration, service_role seul.
-- Idempotent : rejouer ce fichier remplace la fonction à l'identique.

create or replace function public.finance_admin_reference_edit(
  p_entity text,
  p_category text,
  p_subcategory text,
  p_changes jsonb,
  p_idempotency_key text,
  p_actor text default 'nexora'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_entity text := lower(trim(coalesce(p_entity, '')));
  v_category text := trim(coalesce(p_category, ''));
  v_sub text := trim(coalesce(p_subcategory, ''));
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_actor text := coalesce(nullif(trim(coalesce(p_actor, '')), ''), 'nexora');
  v_new text := nullif(trim(coalesce(p_changes->>'name', '')), '');
  v_color text := p_changes->>'color';
  v_has_color boolean := coalesce(p_changes ? 'color', false);
  v_before jsonb;
  v_after jsonb;
  v_entity_key text;
  v_previous jsonb;
  v_tx public.finance_transactions_current%rowtype;
  v_transactions integer := 0;
  v_rules integer := 0;
  v_recurring integer := 0;
  v_protected text[] := array['epargne', 'transferts internes', 'ajustement'];
begin
  if v_key is null then raise exception 'idempotency_key_required'; end if;
  if v_entity not in ('category', 'subcategory') then raise exception 'entity_invalid'; end if;
  if v_category = '' then raise exception 'category_required'; end if;
  if v_entity = 'subcategory' and v_sub = '' then raise exception 'subcategory_required'; end if;
  if (v_new is null or v_new = (case when v_entity = 'category' then v_category else v_sub end)) and not v_has_color then raise exception 'no_change'; end if;
  if v_has_color and v_color is not null and v_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'color_invalid'; end if;
  if v_new is not null and length(v_new) > 80 then raise exception 'name_too_long'; end if;

  -- Idempotence : la même clé renvoie le résultat déjà enregistré.
  select jsonb_build_object('ok', true, 'idempotent', true, 'entity', a.entity, 'key', a.entity_key, 'before', a.before_value, 'after', a.after_value)
    into v_previous
    from public.finance_reference_audit a
   where a.action in ('rename', 'style') and a.after_value->>'idempotency_key' = v_key
   limit 1;
  if v_previous is not null then return v_previous; end if;

  if v_entity = 'category' then
    select to_jsonb(c) into v_before from public.finance_categories_current c where c.category = v_category for update;
    if v_before is null then raise exception 'category_not_found'; end if;
    v_entity_key := v_category;
    if v_new is not null and v_new <> v_category then
      if lower(translate(v_category, 'ÉÈÊéèêÀàÇç', 'EEEeeeAaCc')) = any(v_protected)
        or lower(translate(v_new, 'ÉÈÊéèêÀàÇç', 'EEEeeeAaCc')) = any(v_protected) then
        raise exception 'reference_protected';
      end if;
      if exists (select 1 from public.finance_categories_current where category = v_new) then raise exception 'category_exists'; end if;
      update public.finance_categories_current set category = v_new, updated_at = now() where category = v_category;
      update public.finance_merchant_rules set category = v_new, updated_at = now() where category = v_category;
      get diagnostics v_rules = row_count;
      update public.finance_recurring_rules set category = v_new, updated_at = now() where category = v_category;
      get diagnostics v_recurring = row_count;
      for v_tx in select * from public.finance_transactions_current where category = v_category for update loop
        update public.finance_transactions_current t
           set category = v_new,
               raw = case when jsonb_typeof(t.raw) = 'array' and jsonb_array_length(t.raw) > 8 then jsonb_set(t.raw, '{8}', to_jsonb(v_new)) else t.raw end,
               revision = t.revision + 1,
               updated_at = now()
         where t.transaction_id = v_tx.transaction_id;
        insert into public.finance_write_outbox(idempotency_key, operation, entity_type, entity_id, payload)
        select v_key || ':' || t.transaction_id, 'update', 'transaction', t.transaction_id, to_jsonb(t) - 'raw'
          from public.finance_transactions_current t where t.transaction_id = v_tx.transaction_id;
        v_transactions := v_transactions + 1;
      end loop;
      v_entity_key := v_new;
    end if;
    if v_has_color then
      update public.finance_categories_current set color = v_color, updated_at = now() where category = v_entity_key;
    end if;
    select to_jsonb(c) into v_after from public.finance_categories_current c where c.category = v_entity_key;

  else
    select to_jsonb(s) into v_before from public.finance_subcategories_current s where s.category = v_category and s.subcategory = v_sub for update;
    if v_before is null then raise exception 'subcategory_not_found'; end if;
    v_entity_key := v_sub;
    if v_new is not null and v_new <> v_sub then
      if exists (select 1 from public.finance_subcategories_current where category = v_category and subcategory = v_new) then raise exception 'subcategory_exists'; end if;
      update public.finance_subcategories_current set subcategory = v_new, updated_at = now() where category = v_category and subcategory = v_sub;
      update public.finance_merchant_rules set subcategory = v_new, updated_at = now() where category = v_category and subcategory = v_sub;
      get diagnostics v_rules = row_count;
      for v_tx in select * from public.finance_transactions_current where category = v_category and subcategory = v_sub for update loop
        update public.finance_transactions_current t
           set subcategory = v_new,
               raw = case when jsonb_typeof(t.raw) = 'array' and jsonb_array_length(t.raw) > 9 then jsonb_set(t.raw, '{9}', to_jsonb(v_new)) else t.raw end,
               revision = t.revision + 1,
               updated_at = now()
         where t.transaction_id = v_tx.transaction_id;
        insert into public.finance_write_outbox(idempotency_key, operation, entity_type, entity_id, payload)
        select v_key || ':' || t.transaction_id, 'update', 'transaction', t.transaction_id, to_jsonb(t) - 'raw'
          from public.finance_transactions_current t where t.transaction_id = v_tx.transaction_id;
        v_transactions := v_transactions + 1;
      end loop;
      v_entity_key := v_new;
    end if;
    if v_has_color then
      update public.finance_subcategories_current set color = v_color, updated_at = now() where category = v_category and subcategory = v_entity_key;
    end if;
    select to_jsonb(s) into v_after from public.finance_subcategories_current s where s.category = v_category and s.subcategory = v_entity_key;
    v_entity_key := v_category || ' > ' || v_entity_key;
  end if;

  v_after := v_after || jsonb_build_object('idempotency_key', v_key, 'renamed_transactions', v_transactions, 'renamed_merchant_rules', v_rules, 'renamed_recurring_rules', v_recurring);
  insert into public.finance_reference_audit(actor, action, entity, entity_key, before_value, after_value)
  values (v_actor, case when v_new is not null and v_new is distinct from (case when v_entity = 'category' then v_category else v_sub end) then 'rename' else 'style' end, v_entity, v_entity_key, v_before, v_after);

  return jsonb_build_object('ok', true, 'idempotent', false, 'entity', v_entity, 'key', v_entity_key, 'before', v_before, 'after', v_after,
    'renamedTransactions', v_transactions, 'renamedMerchantRules', v_rules, 'renamedRecurringRules', v_recurring);
end;
$function$;

revoke all on function public.finance_admin_reference_edit(text, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.finance_admin_reference_edit(text, text, text, jsonb, text, text) to service_role;
