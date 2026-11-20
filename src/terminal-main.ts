// BDSI terminal entry (/terminal): Launchpad and the function screens.
import './styles/terminal-page.css';
import { requireSignedIn, signOut } from '@/services/bdsi-auth';
import { mountShell } from '@/terminal/shell';

const root = document.getElementById('tpApp')!;

void requireSignedIn().then((email) => {
  if (email === null) return; // redirected to sign-in
  mountShell(root, email, () => void signOut());
});
