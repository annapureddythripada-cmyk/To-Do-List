import { CheckSquare, ShieldCheck } from 'lucide-react';

interface SignInViewProps {
  onSignIn: () => Promise<void>;
  error: string | null;
}

export function SignInView({ onSignIn, error }: SignInViewProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8FF] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E4DCF5] bg-white p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3B0764] text-white">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-[#1F1235]">
              LavenderTask
            </h1>
            <p className="text-xs text-[#5B4F73]">Personal Task Workspace</p>
          </div>
        </div>

        <h2 className="mt-7 font-display text-2xl font-bold tracking-tight text-[#1F1235] text-balance">
          Organize your priorities with clarity.
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-[#5B4F73]">
          Sign in to access your persistent task dashboard, manage due dates and
          priorities, and keep every update synced in PostgreSQL.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-3.5 py-2.5 text-sm text-[#9F1239]"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={onSignIn}
          className="mt-6 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[#3B0764] px-5 text-sm font-semibold text-white hover:bg-[#4C1D95] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1D95] cursor-pointer"
        >
          <span>Continue with Google</span>
        </button>

        <div className="mt-6 flex items-center gap-2 border-t border-[#F0EBF9] pt-5 text-xs text-[#6D5F8A]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#4C1D95]" />
          <span>Your tasks are private and scoped to your verified account.</span>
        </div>
      </div>
    </div>
  );
}
