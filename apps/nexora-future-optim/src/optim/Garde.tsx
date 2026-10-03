// Garde-fou d'écran (#688) : une erreur de rendu n'emporte plus toute
// l'application. L'écran fautif affiche l'erreur ; la navigation reste
// utilisable et un changement d'écran réessaie.
import { Component, type ReactNode } from "react";

export class GardeEcran extends Component<{ nom: string; children: ReactNode }, { erreur: Error | null }> {
  state = { erreur: null as Error | null };
  static getDerivedStateFromError(erreur: Error) { return { erreur }; }
  componentDidCatch(erreur: Error) { console.error(`Écran ${this.props.nom} :`, erreur); }
  render() {
    const e = this.state.erreur;
    if (!e) return this.props.children;
    return <main className="hx-main"><section className="hx-tile ox-garde" role="alert">
      <h2>Cet écran n'a pas pu s'afficher</h2>
      <p>Une donnée inattendue a provoqué une erreur. Les autres écrans restent utilisables et rien n'a été modifié.</p>
      <pre className="ox-pre">{e.name} : {e.message}</pre>
      <button type="button" className="hx-btn" onClick={() => this.setState({ erreur: null })}>Réessayer</button>
    </section></main>;
  }
}
