import { useSettings } from '../../shared/settings/store';
import { Segmented } from '../../shared/ui/Segmented';
import { Switch } from '../../shared/ui/Switch';
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
        <Row label="Double pages">
          <Segmented
            label="Double pages"
            value={reader.spreads}
            onChange={(spreads) => update({ reader: { spreads } })}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </Row>
        <Row label="First page is a cover">
          <Switch label="First page is a cover" checked={reader.coverAlone} onChange={(coverAlone) => update({ reader: { coverAlone } })} />
        </Row>
        <Row label="Tap zones">
          <Segmented
            label="Tap zones"
            value={reader.tapZones}
            onChange={(tapZones) => update({ reader: { tapZones } })}
            options={[
              { value: 'default', label: 'Default' },
              { value: 'inverted', label: 'Inverted' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </Row>
        <Row label="Page-turn animation">
          <Switch
            label="Page-turn animation"
            checked={reader.pageTransitions}
            onChange={(pageTransitions) => update({ reader: { pageTransitions } })}
          />
        </Row>
        <Row label="Crop white borders">
          <Switch label="Crop white borders" checked={reader.cropBorders} onChange={(cropBorders) => update({ reader: { cropBorders } })} />
        </Row>
      </Card>
    </SettingsSubpage>
  );
}
