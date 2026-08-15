<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'google_id', 'photo_url'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Find or create a user from a Socialite Google user, linking to an
     * existing email/password account by email when one already exists.
     */
    public static function firstOrCreateFromGoogle(\Laravel\Socialite\Contracts\User $googleUser): self
    {
        $user = static::where('google_id', $googleUser->getId())->first();
        if ($user) {
            return $user;
        }

        $user = static::where('email', $googleUser->getEmail())->first();
        if ($user) {
            $user->update(['google_id' => $googleUser->getId(), 'photo_url' => $googleUser->getAvatar()]);

            return $user;
        }

        return static::create([
            'name' => $googleUser->getName(),
            'email' => $googleUser->getEmail(),
            'google_id' => $googleUser->getId(),
            'photo_url' => $googleUser->getAvatar(),
            'password' => bcrypt(str()->random(32)),
            'email_verified_at' => now(),
        ]);
    }
}
