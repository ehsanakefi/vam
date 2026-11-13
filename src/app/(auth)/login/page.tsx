// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Landmark, LockKeyhole, UserRound } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button, Input } from "@/components/ui";
import { loginAction } from "./actions";

const loginSchema = z.object({
  username: z.string().min(3, "نام کاربری حداقل ۳ نویسه است"),
  password: z.string().min(6, "رمز عبور حداقل ۶ نویسه است"),
});

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const formData = new FormData(event.currentTarget);
    formData.append("remember", String(remember));

    const result = loginSchema.safeParse({
      username: formData.get("username"),
      password: formData.get("password"),
    });

    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      return;
    }

    setLoading(true);

    try {
      const res = await loginAction(formData);

      if (!res.success) {
        toast.error(res.error || "خطایی در ورود رخ داد");
        setLoading(false);
        return;
      }

      toast.success("ورود با موفقیت انجام شد");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error("خطایی در ارتباط با سرور رخ داد");
      setLoading(false);
    }
  };

  return (
    <main
      dir="rtl"
      className="login-bg flex min-h-screen items-center justify-center p-4"
    >
      <div className="w-full max-w-md">
        <div className="mb-7 flex justify-center">
          <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-5 py-3 shadow-sm backdrop-blur">
            <div className="grid size-11 place-items-center rounded-xl bg-slate-950 text-teal-300">
              <Landmark className="size-6" />
            </div>
            <div>
              <p className="font-bold text-slate-950">راهکار وام</p>
              <p className="text-xs text-slate-500">پرتال رفاه کارکنان</p>
            </div>
          </div>
        </div>

        <section className="rounded-3xl border border-white/80 bg-white/95 p-7 shadow-2xl shadow-slate-900/10 sm:p-9">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-950">
              ورود به سامانه
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              اطلاعات حساب مدیریتی خود را وارد کنید
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                نام کاربری
              </span>
              <div className="relative">
                <UserRound className="absolute right-3.5 top-3.5 size-5 text-slate-400" />
                <Input
                  name="username"
                  className="pr-11"
                  placeholder="نام کاربری"
                  // defaultValue="admin"
                />
              </div>
              {errors.username && (
                <span className="mt-1.5 block text-xs text-rose-600">
                  {errors.username}
                </span>
              )}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                رمز عبور
              </span>
              <div className="relative">
                <LockKeyhole className="absolute right-3.5 top-3.5 size-5 text-slate-400" />
                <Input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="px-11"
                  placeholder="حداقل ۶ نویسه"
                  // defaultValue="123456"
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute left-1.5 top-1.5 size-8 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="نمایش رمز"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
              {errors.password && (
                <span className="mt-1.5 block text-xs text-rose-600">
                  {errors.password}
                </span>
              )}
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="size-4 accent-teal-600 rounded"
              />
              مرا به خاطر بسپار
            </label>

            <Button className="w-full py-3.5" type="submit" disabled={loading}>
              {loading ? "در حال ورود..." : "ورود به پنل مدیریت"}
            </Button>
          </form>

          <p className="mt-7 text-center text-xs leading-6 text-slate-400">
            دسترسی به این سامانه صرفاً برای مدیران مجاز سازمان امکان‌پذیر است.
          </p>
        </section>
      </div>
    </main>
  );
}
