const supabaseClient = window.supabase.createClient(
  window.ATE_CONFIG.SUPABASE_URL,
  window.ATE_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

function message(id, text, type = "") {
  const el = $(id);
  if (!el) return;

  el.textContent = text;
  el.className = "status-message";

  if (type) {
    el.classList.add(type);
  }

  el.classList.remove("hidden");
}

function hide(id) {
  $(id)?.classList.add("hidden");
}

function baseUrl() {
  return window.location.origin +
    window.location.pathname.substring(
      0,
      window.location.pathname.lastIndexOf("/") + 1
    );
}

function redirectHome() {
  window.location.href = "home.html";
}

async function getProfile(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}

function showLogin() {
  $("loginCard").classList.remove("hidden");
  $("signupCard").classList.add("hidden");
  $("requestCard").classList.add("hidden");
  $("recoveryCard").classList.add("hidden");

  $("tabLogin").classList.add("active");
  $("tabSignup").classList.remove("active");
}

function showSignup() {
  $("loginCard").classList.add("hidden");
  $("signupCard").classList.remove("hidden");
  $("requestCard").classList.add("hidden");
  $("recoveryCard").classList.add("hidden");

  $("tabLogin").classList.remove("active");
  $("tabSignup").classList.add("active");
}

function showRecovery() {
  $("loginCard").classList.add("hidden");
  $("signupCard").classList.add("hidden");
  $("requestCard").classList.add("hidden");
  $("recoveryCard").classList.remove("hidden");
}

function showWaitlist(profile) {
  $("loginCard").classList.add("hidden");
  $("signupCard").classList.add("hidden");
  $("recoveryCard").classList.add("hidden");
  $("requestCard").classList.remove("hidden");

  $("requestNote").value = "";
}

async function sendAccessRequest() {
  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  if (!user) {
    message("requestMessage", "Please sign in first.", "error");
    return;
  }

  const wants2d = $("request2d").checked;
  const wants3d = $("request3d").checked;

  if (!wants2d && !wants3d) {
    message(
      "requestMessage",
      "Select 2D, 3D, or both.",
      "error"
    );
    return;
  }

  const { error } = await supabaseClient
    .from("access_requests")
    .insert({
      user_id: user.id,
      requested_2d: wants2d,
      requested_3d: wants3d,
      note: $("requestNote").value.trim()
    });

  if (error) {
    message("requestMessage", error.message, "error");
    return;
  }

  message(
    "requestMessage",
    "Access request sent to the administrator.",
    "success"
  );
}

async function signIn() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  if (!email || !password) {
    message(
      "loginMessage",
      "Enter your email and password.",
      "error"
    );
    return;
  }

  const button = $("loginButton");
  button.disabled = true;
  button.textContent = "Signing in...";

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  button.disabled = false;
  button.textContent = "Sign In";

  if (error) {
    message("loginMessage", error.message, "error");
    return;
  }

  const profile = await getProfile(data.user.id);

  if (!profile) {
    await supabaseClient.auth.signOut();

    message(
      "loginMessage",
      "Your profile is still being prepared. Contact an administrator.",
      "error"
    );

    return;
  }

  if (profile.status !== "active") {
    if (profile.status === "waitlist") {
      showWaitlist(profile);
      return;
    }

    await supabaseClient.auth.signOut();

    message(
      "loginMessage",
      "This account does not currently have access to AI TRAINER EXPERT.",
      "error"
    );

    return;
  }

  redirectHome();
}

async function signUp() {
  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;

  if (!name || !email || !password) {
    message(
      "signupMessage",
      "Complete all fields.",
      "error"
    );
    return;
  }

  if (password.length < 8) {
    message(
      "signupMessage",
      "Password must contain at least 8 characters.",
      "error"
    );
    return;
  }

  const button = $("signupButton");
  button.disabled = true;
  button.textContent = "Creating request...";

  const { data, error } =
    await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        },
        emailRedirectTo: baseUrl() + "index.html"
      }
    });

  button.disabled = false;
  button.textContent = "Request Access";

  if (error) {
    message("signupMessage", error.message, "error");
    return;
  }

  if (data.session) {
    message(
      "signupMessage",
      "Account created. Your account is now waiting for administrator approval.",
      "success"
    );

    await supabaseClient.auth.signOut();
  } else {
    message(
      "signupMessage",
      "Account created. Check your email to confirm your account, then wait for administrator approval.",
      "success"
    );
  }
}

async function forgotPassword() {
  const email = $("loginEmail").value.trim();

  if (!email) {
    message(
      "loginMessage",
      "Enter your email first.",
      "error"
    );
    return;
  }

  const redirectTo = baseUrl() + "index.html";

  const { error } =
    await supabaseClient.auth.resetPasswordForEmail(
      email,
      { redirectTo }
    );

  if (error) {
    message("loginMessage", error.message, "error");
    return;
  }

  message(
    "loginMessage",
    "If the account exists, a password-reset email has been sent.",
    "success"
  );
}

async function updatePassword() {
  const password = $("newPassword").value;

  if (password.length < 8) {
    message(
      "recoveryMessage",
      "Password must contain at least 8 characters.",
      "error"
    );
    return;
  }

  const { error } =
    await supabaseClient.auth.updateUser({
      password
    });

  if (error) {
    message("recoveryMessage", error.message, "error");
    return;
  }

  message(
    "recoveryMessage",
    "Password updated successfully. Redirecting...",
    "success"
  );

  setTimeout(redirectHome, 1200);
}

async function initialise() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  const params = new URLSearchParams(window.location.search);

  if (params.get("reset") === "1") {
    showRecovery();
    return;
  }

  if (!session) {
    showLogin();
    return;
  }

  const profile = await getProfile(session.user.id);

  if (!profile) {
    await supabaseClient.auth.signOut();
    showLogin();
    return;
  }

  if (profile.status === "active") {
    redirectHome();
    return;
  }

  if (profile.status === "waitlist") {
    showWaitlist(profile);
    return;
  }

  await supabaseClient.auth.signOut();
  showLogin();

  message(
    "loginMessage",
    "This account has been disabled.",
    "error"
  );
}

$("tabLogin").onclick = showLogin;
$("tabSignup").onclick = showSignup;

$("loginButton").onclick = signIn;
$("signupButton").onclick = signUp;
$("forgotPassword").onclick = forgotPassword;
$("requestButton").onclick = sendAccessRequest;
$("updatePasswordButton").onclick = updatePassword;

$("waitlistLogout").onclick = async () => {
  await supabaseClient.auth.signOut();
  showLogin();
};

supabaseClient.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    showRecovery();
  }
});

initialise();
