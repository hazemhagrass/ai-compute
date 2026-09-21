import LoginForm from "@/components/LoginForm";
import { isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  // First run shows setup instead of login: there is nothing to log in to yet.
  return <LoginForm configured={isAuthConfigured()} />;
}
