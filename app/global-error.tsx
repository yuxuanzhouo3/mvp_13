"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center space-y-4">
          <h2 className="text-xl font-semibold">Application error</h2>
          <p className="text-sm text-muted-foreground">{error.message || "Unexpected error occurred."}</p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={reset}>Reload</Button>
            <Button variant="outline" asChild>
              <Link href="/">Go home</Link>
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
