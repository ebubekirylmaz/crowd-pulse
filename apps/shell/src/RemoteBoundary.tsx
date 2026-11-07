import {
  Component,
  type ComponentType,
  lazy,
  type ReactNode,
  Suspense,
  useState,
} from "react";
import { Alert, Button, Card, Spinner } from "@crowd-pulse/ui";

type BoundaryProps = {
  name: string;
  children: ReactNode;
};

class Boundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`remote "${this.props.name}" failed`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
        <Card>
          <h2 className="text-lg font-semibold">
            {this.props.name} is unavailable
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            This part of Crowd Pulse is deployed separately and could not be
            loaded. The rest of the app keeps working.
          </p>
          <div className="mt-4">
            <Alert>Could not load the {this.props.name} module</Alert>
          </div>
          <Button
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Try again
          </Button>
        </Card>
      </div>
    );
  }
}

export default function RemoteBoundary<P extends object>({
  name,
  load,
  props,
}: {
  name: string;
  load: () => Promise<{ default: ComponentType<P> }>;
  props: P;
}) {
  const [Remote] = useState(() => lazy(load));

  return (
    <Boundary name={name}>
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <Spinner />
          </div>
        }
      >
        <Remote {...(props as P & object)} />
      </Suspense>
    </Boundary>
  );
}
