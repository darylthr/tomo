import { useSettings } from '../../shared/settings/store';
import { Segmented } from '../../shared/ui/Segmented';
import { Card, FITS, MODES, Row, SettingsSubpage } from './parts';

/** Settings → Reader: how chapters open. */
export function ReaderSettings() {
  const reader = useSettings((s) => s.settings.reader);
  const update = useSettings((s) => s.update);

  return (
    <SettingsSubpage title="Reader">
      <Card label="Reader">
        <Row label="Default reading mode" stack>
          <Segmented
            label="Default reading mode"
            value={reader.defaultMode}
            onChange={(defaultMode) => update({ reader: { defaultMode } })}
            options={MODES}
          />
        </Row>
        <Row label="Fit pages to">
          <Segmented label="Fit pages to" value={reader.fit} onChange={(fit) => update({ reader: { fit } })} options={FITS} />
        </Row>
      </Card>
    </SettingsSubpage>
  );
}
