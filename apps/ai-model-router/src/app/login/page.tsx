import LoginForm from "@/components/LoginForm";
import { isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm configured={isAuthConfigured()} />;
}
