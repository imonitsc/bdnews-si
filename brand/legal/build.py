"""Builds the public legal pages for BD Situation Intelligence.

Run: python3 brand/legal/build.py
Writes public/about.html, privacy.html, terms.html, copyright.html.
The footer must match src/config/site-footer.ts.
"""
import os
import html

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PUBLIC = os.path.join(ROOT, 'public')
LOGO_SVG = open(os.path.join(ROOT, 'brand', 'header-logo.svg')).read()
LOGO_SVG = LOGO_SVG.replace('<svg ', '<svg aria-hidden="true" focusable="false" ', 1)

OPERATOR = 'The Asia Times Company Ltd'
CONTACT = 'contact@bdnews.si'
UPDATED = '20 November 2026'
YEAR = '2026'
SITE = 'https://www.bdnews.si'
SOURCE = 'https://github.com/imonitsc/bdnews-si'
UPSTREAM = 'https://github.com/koala73/worldmonitor'
AGPL = 'https://www.gnu.org/licenses/agpl-3.0.html'

FOOTER_LINKS = [
    ('/about.html', 'About', ''),
    ('/privacy.html', 'Privacy Policy', ''),
    ('/terms.html', 'Terms of Service', ''),
    ('/copyright.html', 'Copyright', ''),
    (SOURCE, 'Source code (AGPL-3.0)', ' target="_blank" rel="noopener"'),
]


def footer() -> str:
    links = ' · '.join(f'<a href="{h}"{x}>{l}</a>' for h, l, x in FOOTER_LINKS)
    return (f'<footer class="site-footer bdsi-footer"><span class="bdsi-footer-copy">© {YEAR} {OPERATOR} · '
            f'BD Situation Intelligence</span><span class="bdsi-footer-links">{links}</span></footer>')


def page(slug: str, title: str, description: str, body: str) -> str:
    nav = ''.join(
        f'<a href="{h}"{" aria-current=\"page\"" if h == f"/{slug}.html" else ""}>{l}</a>'
        for h, l, _ in FOOTER_LINKS[:4])
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} · BD Situation Intelligence</title>
<meta name="description" content="{html.escape(description)}">
<link rel="canonical" href="{SITE}/{slug}.html">
<meta name="theme-color" content="#000000">
<link rel="icon" type="image/png" sizes="32x32" href="/favico/favicon-32x32.png">
<link rel="stylesheet" href="/legal/legal.css">
</head>
<body>
<header class="lg-top">
  <a class="lg-logo" href="/" aria-label="BD Situation Intelligence home">{LOGO_SVG}</a>
  <nav class="lg-nav" aria-label="Site information">{nav}<a class="lg-open" href="/">Open dashboard</a></nav>
</header>
<main class="lg-main">
<article>
<p class="lg-kicker">BD Situation Intelligence</p>
<h1>{html.escape(title)}</h1>
<p class="lg-updated">Last updated: {UPDATED}</p>
{body}
</article>
</main>
{footer()}
</body>
</html>
'''


ABOUT = f'''
<p class="lg-lead">BD Situation Intelligence is a live situation dashboard for Bangladesh and the world: breaking news from Bangladeshi and international outlets, live television, markets, and risk signals on one screen, in a terminal-style layout.</p>

<h2>What it shows</h2>
<ul>
<li><strong>News.</strong> Headlines from Bangladeshi outlets in English and Bangla, alongside regional and international coverage, with links to the original publishers.</li>
<li><strong>Live TV.</strong> Bangladeshi and international news channels, streamed from the broadcasters' own official YouTube channels.</li>
<li><strong>Markets.</strong> A market ticker, commodities and macro indicators, with Bangladesh market panels in development.</li>
<li><strong>Map.</strong> Unrest, natural hazards, infrastructure and other situational layers across Bangladesh, South Asia and the world.</li>
</ul>
<p>Information on the dashboard is gathered automatically from public sources. It is provided for general information and is not financial, legal or safety advice. Always check important facts with the original source.</p>

<h2>Who runs it</h2>
<p>BD Situation Intelligence is operated by <strong>{OPERATOR}</strong> at <a href="{SITE}">bdnews.si</a>. You can reach us at <a href="mailto:{CONTACT}">{CONTACT}</a>.</p>

<h2>Built on World Monitor</h2>
<p>This service is built with the help of <a href="{UPSTREAM}" target="_blank" rel="noopener">World Monitor</a>, an open-source real-time global intelligence dashboard created and maintained by its authors and contributors. We are grateful for their work. World Monitor provides the dashboard framework, map, data pipelines and many of the panels you see here.</p>
<p>BD Situation Intelligence is an independent, modified version. It is <strong>not affiliated with, sponsored by or endorsed by</strong> the World Monitor project or its authors, and "World Monitor" is their name, not ours.</p>
<p>Our main changes include: the BD Situation Intelligence name, logo and terminal-style design; a Bangladesh and South Asia focus with Bangladeshi news sources and TV channels; the Bangladesh News panel; the command bar and market ticker; account sign-in; and these information pages. A full change log is published with the source code.</p>

<h2>Software licence</h2>
<p>World Monitor is licensed under the <a href="{AGPL}" target="_blank" rel="noopener license">GNU Affero General Public License, version 3 (AGPL-3.0)</a>. As a modified version, BD Situation Intelligence is distributed under the same licence. In short:</p>
<ul>
<li>You may use, study, share and modify the software.</li>
<li>If you run a modified version for users over a network, you must offer those users the complete corresponding source code under the same licence.</li>
<li>The software comes with no warranty, to the extent permitted by law.</li>
</ul>
<p>The complete source code of this website, including our modifications, is available at <a href="{SOURCE}" target="_blank" rel="noopener">{SOURCE.replace("https://", "")}</a>. The licence text is in the <code>LICENSE</code> file there. The licence covers the software; it does not cover news content, TV streams or third-party data, which belong to their owners (see <a href="/copyright.html">Copyright</a>).</p>

<h2>Contact</h2>
<p>Questions, corrections, partnership or press: <a href="mailto:{CONTACT}">{CONTACT}</a>.</p>
'''

PRIVACY = f'''
<p class="lg-lead">This policy explains what personal information BD Situation Intelligence ("we", "us") collects, why, and the choices you have. The service is operated by {OPERATOR}, which is responsible for your information.</p>

<h2>Information we collect</h2>
<ul>
<li><strong>Account information.</strong> When you create an account: your email address, your password (stored only as a secure hash by our sign-in provider, never in readable form) and, if you give it, your name.</li>
<li><strong>Sign-in records.</strong> The dates and times you sign in, and technical records our sign-in provider keeps for security, such as IP address and browser type.</li>
<li><strong>Technical data.</strong> Like any website, our hosting provider receives your IP address, browser and device details and the pages you request, and keeps short-lived logs for security and reliability.</li>
<li><strong>Settings on your device.</strong> Your dashboard layout, panel choices and similar preferences are stored in your own browser, not on our servers.</li>
</ul>
<p>We do not sell your personal information, and we do not use advertising or cross-site tracking cookies.</p>

<h2>Cookies and local storage</h2>
<ul>
<li><code>bdsi_at</code>: a strictly necessary cookie that keeps you signed in. It expires when your session expires or when you log out.</li>
<li>Browser local storage holds your sign-in session and your dashboard preferences. You can clear it at any time in your browser settings; you will then need to sign in again.</li>
<li>When you play a live TV stream, the video is provided by YouTube, which may set its own cookies under <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's privacy policy</a>.</li>
</ul>

<h2>How we use information</h2>
<ul>
<li>To create and secure your account, sign you in and send account emails (confirmation, password reset, sign-in links).</li>
<li>To run, protect and improve the service, including preventing abuse and fixing faults.</li>
<li>To answer you when you contact us.</li>
<li>To meet legal obligations.</li>
</ul>
<p>We do not send marketing emails unless you separately agree to receive them.</p>

<h2>Service providers</h2>
<p>We use trusted providers who process information on our behalf, only for the purposes above:</p>
<ul>
<li><strong>Supabase</strong> — accounts and sign-in (data stored in Mumbai, India).</li>
<li><strong>Resend</strong> — sending account emails.</li>
<li><strong>Vercel</strong> — website hosting and delivery.</li>
<li><strong>Upstash</strong> — data cache for dashboard content (no account information).</li>
<li>Map tiles, news feeds and video streams are loaded from their providers, such as OpenFreeMap and YouTube, which receive your IP address when your browser requests them.</li>
</ul>
<p>Some providers may process information outside Bangladesh. Where they do, we rely on their contractual and security commitments to protect it.</p>

<h2>How long we keep it</h2>
<p>We keep account information for as long as your account is open. If you ask us to delete your account, we delete it within 30 days, except where we must keep limited records by law. Hosting and security logs are kept for a short period, normally no more than 30 days.</p>

<h2>Your choices and rights</h2>
<p>You can ask us to access, correct or delete your personal information, or to stop using it, by writing to <a href="mailto:{CONTACT}">{CONTACT}</a> from the email address on your account. Depending on where you live, you may have further rights under local data protection law, including the right to complain to a data protection authority. We will respond within 30 days.</p>

<h2>Security</h2>
<p>We use encrypted connections (HTTPS), hashed passwords and access controls to protect your information. No online service is perfectly secure, so please use a strong, unique password.</p>

<h2>Children</h2>
<p>The service is not intended for children under 13, and we do not knowingly collect their information. If you believe a child has created an account, contact us and we will delete it.</p>

<h2>Changes</h2>
<p>We may update this policy. We will change the "Last updated" date above and, for significant changes, tell signed-in users by email or on the site.</p>

<h2>Contact</h2>
<p>{OPERATOR} · <a href="mailto:{CONTACT}">{CONTACT}</a></p>
'''

TERMS = f'''
<p class="lg-lead">These terms govern your use of BD Situation Intelligence at bdnews.si (the "service"), operated by {OPERATOR} ("we", "us"). By creating an account or using the service, you agree to them. If you do not agree, please do not use the service.</p>

<h2>1. The service</h2>
<p>The service is a live dashboard that brings together news, live television, market data, maps and risk signals from public sources. We may change, add or remove features at any time, and we may suspend the service for maintenance or for reasons outside our control.</p>

<h2>2. Accounts</h2>
<ul>
<li>You must give a valid email address and keep your password confidential. You are responsible for activity on your account.</li>
<li>Accounts are personal. Do not share your sign-in with others.</li>
<li>Tell us promptly at <a href="mailto:{CONTACT}">{CONTACT}</a> if you think your account has been misused.</li>
<li>You may stop using the service and ask us to delete your account at any time.</li>
</ul>

<h2>3. Information only — not advice</h2>
<p>Content on the service is collected automatically from third-party sources and is provided for general information. It may be delayed, incomplete or wrong. Nothing on the service is financial, investment, legal, medical or safety advice, and market data must not be relied on for trading decisions. Always verify important information with the original source and, where appropriate, a qualified professional.</p>

<h2>4. Third-party content</h2>
<p>News headlines, summaries, images, TV streams, maps and data belong to their respective publishers, broadcasters and providers. We link to and show them to help you find the original. Your use of third-party content and sites is subject to their own terms. We are not responsible for third-party content or availability.</p>

<h2>5. Acceptable use</h2>
<p>You agree not to:</p>
<ul>
<li>break the law or infringe anyone's rights using the service;</li>
<li>try to get around sign-in, security or rate limits, or access accounts or data that are not yours;</li>
<li>overload, disrupt or attack the service, or use automated tools to scrape it at a scale that harms its operation;</li>
<li>resell or republish the service's aggregated content as your own product.</li>
</ul>
<p>We may suspend or close accounts that break these terms.</p>

<h2>6. Open-source software</h2>
<p>The software behind the service is a modified version of World Monitor and is licensed under the <a href="{AGPL}" target="_blank" rel="noopener license">GNU Affero General Public License v3.0</a>. The source code is available at <a href="{SOURCE}" target="_blank" rel="noopener">{SOURCE.replace("https://", "")}</a>. Nothing in these terms limits the rights the AGPL gives you over the software. These terms apply to your use of the hosted service at bdnews.si.</p>

<h2>7. Our name and logo</h2>
<p>The BD Situation Intelligence name and logo belong to {OPERATOR}. The software licence does not give you permission to use them, for example to present a modified copy as ours.</p>

<h2>8. Disclaimer</h2>
<p>The service is provided "as is" and "as available", without warranties of any kind, to the fullest extent permitted by law. We do not promise that the service will be uninterrupted, error-free or accurate.</p>

<h2>9. Limitation of liability</h2>
<p>To the fullest extent permitted by law, {OPERATOR} is not liable for any indirect, incidental or consequential loss, or for loss of profits, data or business, arising from your use of the service or reliance on its content. Our total liability for any claim relating to the service is limited to the amount you paid us for it in the twelve months before the claim (which, for a free account, is nil). Nothing in these terms excludes liability that cannot be excluded by law.</p>

<h2>10. Changes to these terms</h2>
<p>We may update these terms. We will change the "Last updated" date above and, for significant changes, tell signed-in users. Continuing to use the service after a change means you accept the updated terms.</p>

<h2>11. Governing law</h2>
<p>These terms are governed by the laws of the People's Republic of Bangladesh. The courts of Dhaka have exclusive jurisdiction over any dispute arising from them or from the service.</p>

<h2>12. Contact</h2>
<p>{OPERATOR} · <a href="mailto:{CONTACT}">{CONTACT}</a></p>
'''

COPYRIGHT = f'''
<p class="lg-lead">BD Situation Intelligence brings together material from many owners. This page explains who owns what, and how to ask us to remove material you own.</p>

<h2>Our own material</h2>
<p>© {YEAR} {OPERATOR}. The BD Situation Intelligence name, logo, design and original text on this site belong to {OPERATOR}. All rights reserved, except as stated below.</p>

<h2>Software</h2>
<p>The software is a modified version of <a href="{UPSTREAM}" target="_blank" rel="noopener">World Monitor</a>, copyright its authors and contributors, and is licensed under the <a href="{AGPL}" target="_blank" rel="noopener license">GNU Affero General Public License v3.0</a>. Our modifications are licensed under the same licence. The complete source code is at <a href="{SOURCE}" target="_blank" rel="noopener">{SOURCE.replace("https://", "")}</a>.</p>

<h2>News, TV and data</h2>
<ul>
<li><strong>News.</strong> Headlines, short excerpts and images belong to their publishers. We show them to point you to the original article and always link to the source.</li>
<li><strong>Live television.</strong> Channels are shown through the broadcasters' own official YouTube streams. The broadcasts belong to the broadcasters.</li>
<li><strong>Maps.</strong> Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>, available under the Open Database License; map tiles by OpenFreeMap.</li>
<li><strong>Market and other data.</strong> Market quotes, indicators and datasets belong to their providers and are shown for information only.</li>
<li><strong>Fonts.</strong> Typefaces are used under the SIL Open Font License.</li>
</ul>

<h2>Copyright complaints</h2>
<p>If you believe material on BD Situation Intelligence infringes your copyright, email <a href="mailto:{CONTACT}">{CONTACT}</a> with:</p>
<ol>
<li>your name and contact details;</li>
<li>the work you own, and the page address where the material appears;</li>
<li>a statement that you believe in good faith the use is not authorised by you, your agent or the law;</li>
<li>a statement that the information you give is accurate and that you own, or are authorised to act for the owner of, the copyright.</li>
</ol>
<p>We will review your request promptly and remove or disable access to material where appropriate.</p>
'''

PAGES = [
    ('about', 'About Us', 'About BD Situation Intelligence, who runs it, and the open-source World Monitor project it is built on.', ABOUT),
    ('privacy', 'Privacy Policy', 'How BD Situation Intelligence collects, uses and protects personal information.', PRIVACY),
    ('terms', 'Terms of Service', 'The terms for using BD Situation Intelligence.', TERMS),
    ('copyright', 'Copyright', 'Copyright and licensing for BD Situation Intelligence, and how to send a copyright complaint.', COPYRIGHT),
]

for slug, title, desc, body in PAGES:
    with open(os.path.join(PUBLIC, f'{slug}.html'), 'w') as f:
        f.write(page(slug, title, desc, body))
print('wrote', len(PAGES), 'pages')
