'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { changePassword } from "@/lib/actions/user.actions";
import { changePasswordSchema } from "@/lib/utils";

import { Button } from "./ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";

const fields = [
  { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
  { name: "newPassword", label: "New password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
] as const;

const ChangePasswordForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ChangePasswordValues) => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await changePassword(values);

      if (response.ok) {
        form.reset();
        setResult({ ok: true, message: "Password updated." });
      } else {
        setResult({ ok: false, message: response.error });
      }
    } catch {
      setResult({ ok: false, message: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-5">
        {fields.map(({ name, label, autoComplete }) => (
          <FormField
            key={name}
            control={form.control}
            name={name}
            render={({ field }) => (
              <FormItem className="form-item space-y-0">
                <FormLabel className="form-label">{label}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete={autoComplete} className="input-class" {...field} />
                </FormControl>
                <FormMessage className="form-message" />
              </FormItem>
            )}
          />
        ))}

        {result && (
          <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-14 text-success-700" : "text-14 text-red-500"}>
            {result.message}
          </p>
        )}

        <Button type="submit" disabled={isLoading} className="form-btn w-full sm:w-fit sm:px-6">
          {isLoading ? (<><Loader2 size={20} className="animate-spin" /> Updating...</>) : "Update password"}
        </Button>
      </form>
    </Form>
  );
};

export default ChangePasswordForm;
