import {z} from 'zod';
// Budget KDM360 pour l'assistant (#587), par l'API HTTP de Nexora et sa clé
// d'assistant : le MCP n'a aucun accès direct à la base. Mêmes chiffres que les
// widgets Budget de Nexora. La catégorisation garde
// la politique de confirmation de /api/finance/transactions : au-delà de 200 €
// ou sous 85 % de confiance, la réponse est un aperçu à faire confirmer.
export function registerBudgetTools(s,scope,api){
 const read={readOnlyHint:true,openWorldHint:false},write={readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false};
 const emit=data=>({content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data});
 const add=(name,description,inputSchema,annotations,fn)=>s.registerTool(name,{description,inputSchema,annotations},async args=>{try{return emit(await fn(args));}catch(e){return {isError:true,content:[{type:'text',text:e.message||'Nexora budget operation failed'}]};}});
 const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),date=z.string().date();
 const qs=o=>{const p=new URLSearchParams();for(const [k,v] of Object.entries(o))if(v!=null&&v!=='')p.set(k,String(v));const t=p.toString();return t?'?'+t:'';};
 if(scope.includes('nexora:read')){
  add('get_budget_summary','Synthèse Budget d’un mois (par défaut le mois en cours, Europe/Paris) : dépenses (Épargne comprise, Transferts internes et Ajustement exclus), revenus, solde net, budget et reste à dépenser ; suivi par catégorie (budget, réalisé, restant, dépassement) ; dépenses par catégorie ; dépenses des 12 derniers mois ; opérations à catégoriser ; patrimoine par banque et type de compte ; catalogues des comptes et catégories actifs.',{month:month.optional()},read,a=>api('/api/finance/budget-summary'+qs({month:a.month})));
  add('search_budget_transactions','Rechercher les transactions Budget non annulées (lignes de budget exclues), plus récentes d’abord. query cherche sans casse ni accents dans libellé, description, catégorie, sous-catégorie et compte ; dateFrom/dateTo bornent la date effective (incluses) ; minAmount/maxAmount portent sur la valeur absolue. Parcourir nextOffset jusqu’à null pour un résultat exhaustif ; annoncer un résultat tronqué.',{query:z.string().max(200).optional(),dateFrom:date.optional(),dateTo:date.optional(),category:z.string().max(200).optional(),accountId:z.string().max(200).optional(),type:z.enum(['Dépense','Revenu','Remboursement','Transfert','Ajustement','Annulation','Ouverture']).optional(),minAmount:z.number().min(0).optional(),maxAmount:z.number().min(0).optional(),limit:z.number().int().min(1).max(200).default(50),offset:z.number().int().min(0).default(0)},read,a=>api('/api/finance/transactions/search'+qs(a)));
 }
 if(scope.includes('nexora:write')){
  add('categorize_budget_transaction','Changer la catégorie et la sous-catégorie d’une transaction Budget (transactionId lu avec search_budget_transactions, paire lue dans les catalogues de get_budget_summary). Sans confirmed=true, une opération de plus de 200 € ou une confiance inférieure à 0,85 renvoie un aperçu (committed=false, requiresConfirmation) : le montrer à l’utilisateur et ne rappeler avec confirmed=true qu’après son accord explicite. Réutiliser idempotencyKey lors des réessais.',{transactionId:z.string().min(1).max(500),category:z.string().min(1).max(200),subcategory:z.string().min(1).max(200),categoryConfidence:z.number().min(0).max(1).optional(),confirmed:z.boolean().default(false),idempotencyKey:z.string().min(1).max(500)},write,a=>api('/api/finance/transactions','PATCH',{...a,allowAutoCommit:true}));
 }
}
