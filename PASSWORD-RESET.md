# Passordtilbakestilling

Startet fra `main` på `aa2514b791190d2dd863fc4b16fc1f9e80e1cc6a`.
Backup: `backup/before-password-reset-20261015`.

«Glemt passord?» på innloggingssiden åpner `password-reset.html`.
Siden bruker Supabase Auth `resetPasswordForEmail`, og gir samme
suksessmelding uansett om adressen finnes. Supabase håndhever sine serverbaserte
grenser for utsending. Passord lagres bare med `updateUser` etter at en
`PASSWORD_RECOVERY`-sesjon er kontrollert med `getUser`.

Returadressen er fast: `https://sotkajervi.github.io/DartArena/`.
Ingen URL fra brukerinput brukes som redirect. `password-recovery-entry.js`
videresender recovery-fragmentet til passordsiden før lobbyklienten lastes,
og fjerner det fra den opprinnelige historikkoppføringen. Passordsiden fjerner
fragmentet etter at Supabase har lest og kontrollert det, og sender ingen referrer.
Den har en separat klient med minnelagring uten vedvarende sesjon eller
deling med andre faner. Etter passordbytte avsluttes bare recovery-sesjonen;
brukeren bes logge inn på vanlig måte. Ingen konto, profil eller kamprad opprettes
eller endres av denne koden. Supabases egne regler for sesjoner etter passordbytte gjelder.

## Supabase-oppsett

I Authentication → URL Configuration må Site URL være
`https://sotkajervi.github.io/DartArena/`, eller denne eksakte adressen må være
tillatt under Redirect URLs. Bruk eksakte adresser i produksjon.
Recovery-epostmalen må bruke `{{ .ConfirmationURL }}` slik at Supabase verifiserer
engangstokenet før retur. En egendefinert PKCE/token-hash-mal støttes ikke av denne
rene HTML-flyten. Supabase SDK er beholdt på repoets eksisterende versjon 2.117.2.

## Bygg og kontroll

Ny kode ligger i `src/pages/password-reset.ts`. GitHub Pages har ingen
TypeScript-byggejobb, så generert `password-reset.js` må sjekkes inn sammen med
kilden. Kjør `npm run build:password-reset` etter endringer og
`npm run test:password-reset` for kontroll. Testen bekrefter også at generert fil
matcher kilden. Vanlige type-, lint- og regresjonskontroller gjelder i tillegg.

Testene dekker fast redirect, nøytral utsendingsmelding, isolert sesjon,
blokkert direkte tilgang, utløpt lenke, passordlengde, ulike passord,
kontroll av kontoidentitet, vellykket oppdatering, svak-passord-feil,
ratebegrensning og videresending fra lobbyinngangen.

En full ende-til-ende-test krever tilgang til innboksen til en eksisterende
testkonto: be om lenke, åpne e-posten, velg nytt passord, logg inn og kontroller
at profil og kamphistorikk fortsatt tilhører samme bruker-ID. Test også gjenbruk
av lenken og en utløpt lenke. Ikke bruk en annen spillers konto til testen.

## Tilbakeføring

Reverter implementeringscommiten ved behov. Backup-branchen inneholder den
tidligere frontend-versjonen. Ingen databasemigrering eller kampkode er endret.
