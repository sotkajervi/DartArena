// Generated from src/pages/password-reset.ts. Do not edit directly.
const sdk = window.supabase;
const element = (id) => document.getElementById(id);
const message = element('resetMessage');
const requestForm = element('requestForm');
const passwordForm = element('passwordForm');
const submit = element('savePassword');
const fragment = new URLSearchParams(location.hash.slice(1));
const isRecovery = fragment.get('type') === 'recovery' &&
    !!fragment.get('access_token') &&
    !!fragment.get('refresh_token');
let recoveryUserId = null;
let saving = false;
function say(text, error = false) {
    message.textContent = text;
    message.className = 'message ' + (error ? 'error' : 'ok');
}
function failRecovery() {
    recoveryUserId = null;
    passwordForm.hidden = true;
    requestForm.hidden = false;
    say('Lenken er ugyldig eller utløpt. Be om en ny lenke nedenfor.', true);
}
if (!sdk) {
    say('Kunne ikke laste innloggingstjenesten. Last siden på nytt og prøv igjen.', true);
    element('sendReset').disabled = true;
}
else {
    // An isolated, memory-only client keeps recovery out of any active match's session.
    const { auth } = sdk.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co', 'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK', {
        auth: {
            storageKey: 'dartarena-password-recovery',
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: isRecovery,
            flowType: 'implicit',
        },
    });
    requestForm.onsubmit = async (event) => {
        event.preventDefault();
        const button = element('sendReset');
        if (button.disabled)
            return;
        button.disabled = true;
        say('Sender lenke…');
        try {
            // Fixed production destination; never accept a next/redirect URL from input.
            // The lobby entry forwards recovery fragments before its Supabase client starts.
            const { error } = await auth.resetPasswordForEmail(element('resetEmail').value.trim(), { redirectTo: 'https://sotkajervi.github.io/DartArena/' });
            if (error)
                throw error;
            say('Hvis e-postadressen er registrert, får du en lenke for å velge nytt passord. Sjekk også søppelpost.');
        }
        catch (error) {
            const code = error.code;
            say(code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit'
                ? 'For mange forsøk. Vent litt før du prøver igjen.'
                : 'Kunne ikke sende lenken. Kontroller nettet og prøv igjen.', true);
        }
        finally {
            button.disabled = false;
        }
    };
    auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' && isRecovery && session?.user.id) {
            // Do not call asynchronous Auth methods while its event lock is held.
            setTimeout(() => {
                void (async () => {
                    try {
                        const { data, error } = await auth.getUser();
                        if (error || data.user?.id !== session.user.id)
                            return failRecovery();
                        recoveryUserId = data.user.id;
                        requestForm.hidden = true;
                        passwordForm.hidden = false;
                        submit.disabled = false;
                        say('Lenken er bekreftet. Velg et nytt passord for kontoen din.');
                        element('newPassword').focus();
                    }
                    catch {
                        failRecovery();
                    }
                })();
            }, 0);
        }
    });
    passwordForm.onsubmit = async (event) => {
        event.preventDefault();
        if (!recoveryUserId || saving)
            return;
        const password = element('newPassword').value;
        if (password.length < 12)
            return say('Bruk minst 12 tegn i det nye passordet.', true);
        if (password !== element('confirmPassword').value)
            return say('Passordene er ikke like.', true);
        saving = true;
        submit.disabled = true;
        say('Lagrer nytt passord…');
        try {
            const verified = await auth.getUser();
            if (verified.error || verified.data.user?.id !== recoveryUserId)
                return failRecovery();
            const { data, error } = await auth.updateUser({ password });
            if (error)
                throw error;
            if (data.user?.id !== recoveryUserId)
                throw new Error('Unexpected account');
            recoveryUserId = null;
            passwordForm.reset();
            passwordForm.hidden = true;
            requestForm.hidden = true;
            say('Passordet er oppdatert. Logg inn med det nye passordet. Kontoen og kamphistorikken din er beholdt.');
            // Only end this recovery session; do not sign out other tabs or matches.
            await auth.signOut({ scope: 'local' }).catch(() => undefined);
        }
        catch (error) {
            const code = error.code;
            say(code === 'same_password'
                ? 'Velg et annet passord enn det gamle.'
                : code === 'weak_password'
                    ? 'Passordet er for svakt. Velg et lengre og mer unikt passord.'
                    : 'Kunne ikke oppdatere passordet. Prøv igjen, eller be om en ny lenke.', true);
        }
        finally {
            saving = false;
            submit.disabled = !recoveryUserId;
        }
    };
    if (isRecovery) {
        requestForm.hidden = true;
        say('Kontrollerer lenken…');
        // getUser waits for URL initialization and also detects expired/invalid tokens.
        void auth
            .getUser()
            .then(({ error }) => {
            if (error)
                failRecovery();
        })
            .catch(failRecovery)
            .finally(() => history.replaceState(null, '', location.pathname));
    }
    else if (location.hash || new URLSearchParams(location.search).has('recovery')) {
        failRecovery();
        history.replaceState(null, '', location.pathname);
    }
}
export {};
