## 1. Update Link Statistics in Devices Page

- [x] 1.1 Add RSSI and SNR `<KV>` rows to `Link Statistics` panel in `dashboard/src/pages/DevicesPage.tsx`
- [x] 1.2 Remove the BME680 entry from `SUBSYSTEMS` array in `dashboard/src/pages/DevicesPage.tsx`

## 2. Clean Up BME680 in Demo Simulation & Protocol Definitions

- [x] 2.1 Update `dashboard/src/lib/demo.ts` to remove `FLAG.BME680` and set environmental sources to SCD40 / MS5607
- [x] 2.2 Mark BME680 as deprecated/legacy in `dashboard/src/lib/types.ts` and `dashboard/src/lib/protocol.ts`

## 3. Verification & UI Check

- [x] 3.1 Run TypeScript typecheck in `dashboard/` (`npm run typecheck`)
- [x] 3.2 Verify dashboard dev server renders updated Devices page without errors
