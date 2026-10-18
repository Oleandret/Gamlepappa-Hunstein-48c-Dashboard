import {Component} from 'react';
// A malformed integration response must not take navigation and the whole app down.
export class SectionBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<section className="panel p-5 mt-5" role="alert"><h1 className="text-xl">Denne fanen kunne ikke vises</h1><p className="mt-2 text-sm">Datakilden eller visningen feilet. Andre faner er fortsatt tilgjengelige.</p><button className="btn mt-3" onClick={()=>this.setState({failed:false})}>Prøv visningen igjen</button></section>:this.props.children;}
}
