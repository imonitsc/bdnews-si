"""Builds the Supabase Auth email templates for BD Situation Intelligence.

Run: python3 brand/email-templates/build.py
Writes one .html per template next to this script, plus subjects.json.
Placeholders like {{ .ConfirmationURL }} are Supabase template variables.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = 'https://www.bdnews.si'
LOGO = f'{SITE}/brand/email-logo-white.png'
AMBER = '#FFA31A'
FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
MONO = "'SF Mono',Menlo,Consolas,'Liberation Mono',monospace"


def button(url_var: str, label: str) -> str:
    return f'''<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
  <tr><td bgcolor="{AMBER}" style="background:{AMBER};">
    <a href="{url_var}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:{FONT};font-size:15px;font-weight:700;color:#000000;text-decoration:none;letter-spacing:0.02em;">{label}</a>
  </td></tr>
</table>'''


def fallback(url_var: str) -> str:
    return f'''<p style="margin:20px 0 0;font-family:{FONT};font-size:12px;line-height:1.6;color:#6b6b6b;">Button not working? Copy this link into your browser:<br>
<a href="{url_var}" style="color:#8a5a00;word-break:break-all;">{url_var}</a></p>'''


def code_box(var: str) -> str:
    return f'''<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
  <tr><td style="border:1px solid #e3e3e3;background:#fafafa;padding:14px 22px;font-family:{MONO};font-size:26px;font-weight:700;letter-spacing:0.25em;color:#000000;">{var}</td></tr>
</table>'''


def page(preheader: str, label: str, heading: str, body_html: str, note: str) -> str:
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>{heading}</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f2f2" style="background:#f2f2f2;">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
      <tr><td bgcolor="#000000" style="background:#000000;padding:22px 28px;">
        <a href="{SITE}" target="_blank" style="text-decoration:none;"><img src="{LOGO}" width="220" alt="BD Situation Intelligence" style="display:block;width:220px;max-width:100%;height:auto;border:0;color:#ffffff;font-family:{FONT};font-size:18px;font-weight:700;"></a>
      </td></tr>
      <tr><td bgcolor="{AMBER}" style="background:{AMBER};height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
      <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:34px 28px 30px;">
        <p style="margin:0 0 10px;font-family:{MONO};font-size:11px;font-weight:700;letter-spacing:0.14em;color:#8a5a00;text-transform:uppercase;">{label}</p>
        <h1 style="margin:0 0 16px;font-family:{FONT};font-size:24px;line-height:1.25;font-weight:800;color:#000000;">{heading}</h1>
        {body_html}
        <p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #ececec;font-family:{FONT};font-size:12.5px;line-height:1.6;color:#6b6b6b;">{note}</p>
      </td></tr>
      <tr><td style="padding:18px 28px 0;font-family:{FONT};font-size:11px;line-height:1.7;color:#8c8c8c;text-align:center;">
        BD Situation Intelligence · Live news, markets and risk for Bangladesh<br>
        <a href="{SITE}" style="color:#8c8c8c;">bdnews.si</a> · This is an automatic message; replies are not read.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
'''


def para(text: str) -> str:
    return f'<p style="margin:0 0 12px;font-family:{FONT};font-size:15px;line-height:1.6;color:#262626;">{text}</p>'


IGNORE = "Didn't ask for this? You can safely ignore this email; nothing will change on your account."

TEMPLATES = {
    'confirm-signup': {
        'subject': 'Confirm your BD Situation Intelligence account',
        'html': page(
            'Confirm your email to activate your account.',
            'Account', 'Confirm your email',
            para('Welcome to BD Situation Intelligence: live news, TV, markets and risk for Bangladesh in one terminal.')
            + para('Confirm your email address to activate your account.')
            + button('{{ .ConfirmationURL }}', 'Confirm email')
            + fallback('{{ .ConfirmationURL }}'),
            "Didn't create an account? Ignore this email and the account will not be activated."),
    },
    'reset-password': {
        'subject': 'Reset your BD Situation Intelligence password',
        'html': page(
            'Use this link to choose a new password.',
            'Security', 'Reset your password',
            para('We received a request to reset the password for <strong>{{ .Email }}</strong>.')
            + para('Choose a new password with the button below. The link works once and expires soon.')
            + button('{{ .ConfirmationURL }}', 'Choose a new password')
            + fallback('{{ .ConfirmationURL }}'),
            IGNORE + ' Your current password keeps working.'),
    },
    'magic-link': {
        'subject': 'Your BD Situation Intelligence sign-in link',
        'html': page(
            'Your one-time sign-in link.',
            'Sign in', 'Sign in to BD Situation Intelligence',
            para('Use the button below to sign in. The link works once and expires soon.')
            + button('{{ .ConfirmationURL }}', 'Sign in')
            + fallback('{{ .ConfirmationURL }}'),
            IGNORE),
    },
    'invite': {
        'subject': "You're invited to BD Situation Intelligence",
        'html': page(
            'You have been invited to BD Situation Intelligence.',
            'Invitation', "You're invited",
            para('You have been invited to BD Situation Intelligence: live news, TV, markets and risk for Bangladesh.')
            + para('Accept the invitation to set up your account.')
            + button('{{ .ConfirmationURL }}', 'Accept invitation')
            + fallback('{{ .ConfirmationURL }}'),
            "Not expecting this? You can ignore this email."),
    },
    'change-email': {
        'subject': 'Confirm your new email address',
        'html': page(
            'Confirm the change of your account email.',
            'Account', 'Confirm your new email',
            para('Please confirm changing your account email from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>.')
            + button('{{ .ConfirmationURL }}', 'Confirm new email')
            + fallback('{{ .ConfirmationURL }}'),
            "Didn't request this? Ignore this email and your address stays the same."),
    },
    'reauthentication': {
        'subject': 'Your BD Situation Intelligence verification code',
        'html': page(
            'Your verification code.',
            'Security', 'Confirm it’s you',
            para('Enter this code to continue:')
            + code_box('{{ .Token }}'),
            IGNORE),
    },
}

subjects = {}
for name, t in TEMPLATES.items():
    with open(os.path.join(HERE, f'{name}.html'), 'w') as f:
        f.write(t['html'])
    subjects[name] = t['subject']
with open(os.path.join(HERE, 'subjects.json'), 'w') as f:
    json.dump(subjects, f, indent=2, ensure_ascii=False)
    f.write('\n')
print('wrote', len(TEMPLATES), 'templates')
