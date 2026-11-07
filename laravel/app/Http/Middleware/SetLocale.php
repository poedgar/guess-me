<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        // Prior to an explicit in-session switch (via POST /locale, which sets
        // `locale_explicit`), an authenticated user's stored preference takes
        // priority over any locale already stamped into the session — e.g. by
        // a pre-login guest visit to /login, which would otherwise mask the
        // stored preference for the rest of the session since login doesn't
        // clear session data. Once the user explicitly switches locale this
        // session, that choice sticks for the rest of the session regardless
        // of what's stored on the user record.
        $locale = (session('locale_explicit') ? session('locale') : null)
            ?? $request->user()?->locale
            ?? session('locale')
            ?? 'uk';

        app()->setLocale($locale);
        session(['locale' => $locale]);

        return $next($request);
    }
}
