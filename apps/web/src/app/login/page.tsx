"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Lock, User, ArrowRight, Sparkles, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg("Harap masukkan username dan password.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Login gagal.");
      }

      // Hard redirect to target so Next.js middleware and browser cookies synchronize cleanly
      window.location.href = redirectTarget;
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-zinc-950/80 backdrop-blur-xl border-zinc-800 shadow-2xl">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-base font-semibold text-white flex items-center justify-between">
          <span>Sign In</span>
          <Badge variant="outline" className="font-mono text-[10px] border-zinc-700 text-zinc-400">
            PRO-DESK
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs text-zinc-400">
          Masukkan kredensial akun terverifikasi Anda untuk mengakses terminal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/80 text-xs text-red-200 font-mono">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300 font-mono flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-zinc-400" />
              <span>Username</span>
            </Label>
            <Input
              type="text"
              autoCapitalize="none"
              autoComplete="username"
              placeholder="Masukkan username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-black border-zinc-800 text-zinc-100 text-xs font-mono h-9 focus-visible:ring-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300 font-mono flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-zinc-400" />
              <span>Password</span>
            </Label>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-black border-zinc-800 text-zinc-100 text-xs font-mono h-9 focus-visible:ring-emerald-500"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-zinc-100 text-black hover:bg-white text-xs font-semibold h-9 mt-2 flex items-center justify-center gap-2 shadow-none border-0"
          >
            {isLoading ? (
              <span>Mengautentikasi...</span>
            ) : (
              <>
                <span>Unlock Terminal</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-5 pt-4 border-t border-zinc-900 text-center">
          <p className="text-[11px] text-zinc-500 font-mono">
            Belum memiliki akun? Hubungi Owner untuk pendaftaran akun melalui portal konfigurasi.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Institutional Access Gateway</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono flex items-center justify-center gap-2">
            <span>NEED PIPS FOR PORSCHE</span>
          </h1>
          <p className="text-xs text-zinc-400 font-mono">
            High-Frequency AI Scalping & Consensus Terminal
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-zinc-500 font-mono text-xs">Memuat formulir...</div>}>
          <LoginForm />
        </Suspense>

        {/* Footer info */}
        <div className="text-center">
          <p className="text-[10px] text-zinc-600 font-mono">
            Protected by PostgreSQL RBAC & Institutional Activity Auditing
          </p>
        </div>
      </div>
    </div>
  );
}
