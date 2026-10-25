export function signInErrorMessage(error: {code?:string;status?:number;name?:string} | null) {
  if(error?.code==='invalid_credentials')return 'The email or password was not accepted. Check them and try again.';
  if(error?.code==='email_not_confirmed')return 'Confirm your email address before signing in.';
  if(error?.status===429||error?.code==='over_request_rate_limit')return 'Too many sign-in attempts. Wait a few minutes and try again.';
  return 'The sign-in service is unavailable or could not be reached. Please try again shortly. This does not mean your password is incorrect.';
}
