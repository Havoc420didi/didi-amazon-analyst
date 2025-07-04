"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SiGithub, SiGoogle } from "react-icons/si";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const t = useTranslations();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // 客户端验证
    if (password !== confirmPassword) {
      setError(t("sign_modal.password_mismatch"));
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError(t("sign_modal.password_too_short"));
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          username: username || undefined,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("sign_modal.register_error"));
        return;
      }

      // 注册成功，自动登录
      const result = await signIn("credentials", {
        identifier: email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t("sign_modal.register_success_login_failed"));
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      setError(t("sign_modal.register_error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {t("sign_modal.sign_up_title")}
          </CardTitle>
          <CardDescription>
            {t("sign_modal.sign_up_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="flex flex-col gap-4">
              {process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => signIn("google")}
                  disabled={isLoading}
                >
                  <SiGoogle className="w-4 h-4" />
                  {t("sign_modal.google_sign_up")}
                </Button>
              )}
              {process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED === "true" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => signIn("github")}
                  disabled={isLoading}
                >
                  <SiGithub className="w-4 h-4" />
                  {t("sign_modal.github_sign_up")}
                </Button>
              )}
            </div>

            {process.env.NEXT_PUBLIC_AUTH_CREDENTIALS_ENABLED !== "false" && (
              <>
                <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                  <span className="relative z-10 bg-background px-2 text-muted-foreground">
                    {t("sign_modal.or_continue_with")}
                  </span>
                </div>
                <form onSubmit={handleRegister}>
                  <div className="grid gap-6">
                    {error && (
                      <div className="text-sm text-red-500 text-center">
                        {error}
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label htmlFor="email">
                        {t("sign_modal.email")} *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t("sign_modal.email_placeholder")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="username">
                        {t("sign_modal.username")} ({t("sign_modal.optional")})
                      </Label>
                      <Input
                        id="username"
                        type="text"
                        placeholder={t("sign_modal.username_placeholder")}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">
                        {t("sign_modal.password")} *
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder={t("sign_modal.password_placeholder")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="confirmPassword">
                        {t("sign_modal.confirm_password")} *
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder={t("sign_modal.confirm_password_placeholder")}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? t("sign_modal.creating_account") : t("sign_modal.create_account")}
                    </Button>
                  </div>
                </form>
                <div className="text-center text-sm">
                  {t("sign_modal.already_have_account")}{" "}
                  <a href="/auth/signin" className="underline underline-offset-4">
                    {t("sign_modal.sign_in")}
                  </a>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        {t("sign_modal.terms_agreement")}{" "}
        <a href="/terms-of-service" target="_blank">
          {t("sign_modal.terms_of_service")}
        </a>{" "}
        {t("sign_modal.and")}{" "}
        <a href="/privacy-policy" target="_blank">
          {t("sign_modal.privacy_policy")}
        </a>
        .
      </div>
    </div>
  );
}