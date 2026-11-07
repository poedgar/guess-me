<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class LocaleController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate(['locale' => ['required', 'in:uk,en']]);

        // Mark this session's locale as an explicit user choice so SetLocale
        // keeps honoring it for the rest of the session, even if it later
        // conflicts with the authenticated user's stored preference (e.g. a
        // guest switches locale, then logs into an account with a different
        // stored locale — the explicit in-session choice should win).
        session(['locale' => $validated['locale'], 'locale_explicit' => true]);
        app()->setLocale($validated['locale']);

        if ($request->user()) {
            $request->user()->update(['locale' => $validated['locale']]);
        }

        return back();
    }
}
