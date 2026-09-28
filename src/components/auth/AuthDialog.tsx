import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { signInWithPassword, signUpWithPassword, signInWithGoogle } from "@/lib/auth";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean(),
});

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.46H12v4.65h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}

export function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const [confirmSent, setConfirmSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const signUpSchema = z
    .object({
      email: z.string().email(),
      password: z.string().min(6),
      confirmPassword: z.string(),
    })
    .refine((v) => v.password === v.confirmPassword, {
      message: t("auth.errors.passwords_dont_match"),
      path: ["confirmPassword"],
    });

  const signInForm = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", remember: true },
  });
  const signUpForm = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setConfirmSent(false);
      signInForm.reset();
      signUpForm.reset();
    }
    onOpenChange(v);
  };

  const onSignIn = signInForm.handleSubmit(async ({ email, password, remember }) => {
    try {
      await signInWithPassword(email, password, remember);
    } catch (err) {
      signInForm.setError("root", { message: err instanceof Error ? err.message : String(err) });
    }
  });

  const onSignUp = signUpForm.handleSubmit(async ({ email, password }) => {
    try {
      const { needsEmailConfirmation } = await signUpWithPassword(email, password);
      if (needsEmailConfirmation) setConfirmSent(true);
      else handleOpenChange(false);
    } catch (err) {
      signUpForm.setError("root", { message: err instanceof Error ? err.message : String(err) });
    }
  });

  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      setGoogleLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {confirmSent ? (
          <div className="py-4 text-center">
            <MailCheck className="mx-auto h-10 w-10 text-primary" />
            <h3 className="mt-4 font-display text-xl">{t("auth.check_email_title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("auth.check_email_body")}</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("auth.title")}</DialogTitle>
              <DialogDescription>{t("auth.subtitle")}</DialogDescription>
            </DialogHeader>

            <Button type="button" variant="outline" className="w-full" disabled={googleLoading} onClick={onGoogle}>
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
              {t("auth.continue_with_google")}
            </Button>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              {t("auth.or")}
              <div className="h-px flex-1 bg-border" />
            </div>

            <Tabs defaultValue="in">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="in">{t("auth.sign_in")}</TabsTrigger>
                <TabsTrigger value="up">{t("auth.sign_up")}</TabsTrigger>
              </TabsList>

              <TabsContent value="in">
                <Form {...signInForm}>
                  <form onSubmit={onSignIn} className="space-y-3">
                    <FormField
                      control={signInForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.email")}</FormLabel>
                          <FormControl>
                            <Input type="email" autoComplete="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signInForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.password")}</FormLabel>
                          <FormControl>
                            <Input type="password" autoComplete="current-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signInForm.control}
                      name="remember"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                          </FormControl>
                          <FormLabel className="cursor-pointer font-normal text-sm">
                            {t("auth.remember_me")}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    {signInForm.formState.errors.root && (
                      <p className="text-[0.8rem] font-medium text-destructive">
                        {signInForm.formState.errors.root.message}
                      </p>
                    )}
                    <Button type="submit" className="w-full" disabled={signInForm.formState.isSubmitting}>
                      {signInForm.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t("auth.sign_in")}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="up">
                <Form {...signUpForm}>
                  <form onSubmit={onSignUp} className="space-y-3">
                    <FormField
                      control={signUpForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.email")}</FormLabel>
                          <FormControl>
                            <Input type="email" autoComplete="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signUpForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.password")}</FormLabel>
                          <FormControl>
                            <Input type="password" autoComplete="new-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signUpForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.confirm_password")}</FormLabel>
                          <FormControl>
                            <Input type="password" autoComplete="new-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {signUpForm.formState.errors.root && (
                      <p className="text-[0.8rem] font-medium text-destructive">
                        {signUpForm.formState.errors.root.message}
                      </p>
                    )}
                    <Button type="submit" className="w-full" disabled={signUpForm.formState.isSubmitting}>
                      {signUpForm.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t("auth.sign_up")}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
