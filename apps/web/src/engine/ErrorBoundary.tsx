import { Component, PropsWithChildren } from "react";

export class ErrorBoundary extends Component<PropsWithChildren, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: unknown) {
    console.error("[ErrorBoundary] caught:", error, info);
  }
  render() {
    if (this.state.error) {
      return null;
    }
    return this.props.children;
  }
}
