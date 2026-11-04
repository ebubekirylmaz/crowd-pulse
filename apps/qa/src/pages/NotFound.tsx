import { Link } from "react-router-dom";
import {
  buttonStyles,
  Card,
  EmptyState,
  GradientScreen,
  Logo,
} from "../components/ui";
import { PulseIcon } from "../components/icons";

export default function NotFound() {
  return (
    <GradientScreen>
      <Logo />
      <Card className="w-full">
        <EmptyState
          icon={<PulseIcon className="h-6 w-6" />}
          title="Page not found"
          hint="The address may be wrong. You can join a room by entering its code on the home page."
        />
        <div className="flex justify-center pb-2">
          <Link to="/" className={buttonStyles({ size: "sm" })}>
            Back to home
          </Link>
        </div>
      </Card>
    </GradientScreen>
  );
}
