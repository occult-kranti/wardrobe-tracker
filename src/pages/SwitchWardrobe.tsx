import { useSession } from '../context/SessionContext';
import { Button, Card, Masthead, SectionTitle } from '../components/ui';
import { Basting } from '../components/art';
import { AccountMark } from '../components/social';

/**
 * Switching wardrobes. Nothing is written and nothing is lost — every mutation
 * already writes through to its own wardrobe's store, so this changes one field:
 * which one is open. The shared rail stays where it is and is simply spoken for
 * by a different wardrobe afterwards.
 */
export default function SwitchWardrobe() {
  const { accounts, activeId, signIn, signOut, installSamples } = useSession();

  return (
    <div className="space-y-6">
      <Masthead title="Wardrobes" meta={`${accounts.length} on this device`} />
      <p className="type-ledger text-[11px] text-text-2 -mt-2">
        Kept in this browser, one record each. Nothing here is an account.
      </p>

      <Card>
        <SectionTitle aside="choose one">Open a wardrobe</SectionTitle>
        <ul>
          {accounts.map(account => {
            const open = account.id === activeId;
            return (
              <li key={account.id}>
                <button
                  type="button"
                  onClick={() => signIn(account.id)}
                  disabled={open}
                  className="w-full flex items-center gap-4 min-h-[72px] py-2 text-left group disabled:opacity-100"
                >
                  <AccountMark account={account} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] text-text group-hover:underline underline-offset-[3px]">
                      {account.name}
                    </span>
                    <span className="type-ledger text-[11px] text-text-2 block mt-1">
                      {account.handle}
                      {account.city ? ` · ${account.city}` : ''}
                      {account.isSample ? ' · sample' : ''}
                    </span>
                  </span>
                  {open ? (
                    <span className="type-ledger text-[11px] text-text-2 shrink-0">open</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        <Basting className="my-4" />

        <div className="flex flex-wrap items-center gap-3">
          <Button tone="primary" onClick={signOut}>Close this wardrobe</Button>
          {accounts.some(a => a.isSample) ? null : (
            <Button onClick={installSamples}>Add the sample wardrobes</Button>
          )}
        </div>
        <p className="type-ledger text-[11px] text-text-2 mt-4">
          Closing returns to the chooser, where a new wardrobe can be started. Nothing is deleted.
        </p>
      </Card>
    </div>
  );
}
