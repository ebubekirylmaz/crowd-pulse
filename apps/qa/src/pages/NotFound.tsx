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
          title="Sayfa bulunamadı"
          hint="Adres hatalı olabilir. Oda kodunu ana sayfadan girerek katılabilirsin."
        />
        <div className="flex justify-center pb-2">
          <Link to="/" className={buttonStyles({ size: "sm" })}>
            Ana sayfaya dön
          </Link>
        </div>
      </Card>
    </GradientScreen>
  );
}
