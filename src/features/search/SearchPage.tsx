import { useSearchParams } from 'react-router-dom';
import { Page, PageNote } from '../../shared/ui/Page';

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q')?.trim();
  return (
    <Page title={q ? `Results for "${q}"` : 'Search'}>
      <PageNote>
        {q ? 'Searching sources arrives with the server connection.' : 'Use the search icon above to search all sources.'}
      </PageNote>
    </Page>
  );
}
