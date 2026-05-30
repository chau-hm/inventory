# Spec Slice: Item Domain Model And Validation

## User-Facing Behavior

The app can validate a durable inventory item before any persistence layer exists. This slice establishes the stable item shape that later `item add`, `item edit`, `item list`, and storage code will use.

The user value is that an agent or CLI can reject incomplete or invalid item data early, before any local database or document attachment code is introduced.

## Inputs

- `name`: required non-empty item name.
- `category`: required non-empty category.
- `status`: optional lifecycle status; defaults to `active`.
- Optional descriptive fields: `brand`, `model`, `serialNumber`, `location`, `owner`, `merchant`, `notes`.
- Optional purchase fields: `purchaseDate`, `purchasePriceMinor`, `currency`.
- Optional warranty fields: `warrantyStart`, `warrantyEnd`, `warrantyMonths`.
- Optional timestamps: `createdAt`, `updatedAt`, `deletedAt`.

## Output

The domain validator returns a normalized item draft:

- Trims user-facing string fields.
- Defaults `status` to `active`.
- Requires `deletedAt` when status is `deleted`.
- Requires no `deletedAt` for non-deleted statuses.
- Preserves optional warranty facts for the warranty domain to interpret.

## Lifecycle Rules

Allowed statuses:

- `active`
- `archived`
- `sold`
- `disposed`
- `lost`
- `deleted`

Deletion is soft delete. A `deleted` item is excluded from normal lists in later slices, but remains recoverable. `sold`, `disposed`, and `lost` are not deletion states and remain searchable/exportable by default.

## Validation Rules

- `name` and `category` must be non-empty after trimming.
- Date fields must use `YYYY-MM-DD`.
- Timestamp fields must be valid ISO datetime strings.
- `purchasePriceMinor` must be a non-negative integer when present.
- `warrantyMonths` must be a non-negative integer when present.
- `currency` must be a three-letter uppercase currency code when present.
- If `purchasePriceMinor` is present, `currency` is required.
- If `status` is `deleted`, `deletedAt` is required.
- If `status` is not `deleted`, `deletedAt` must be omitted.

## Acceptance Criteria

- Minimal item with name/category validates and defaults to `active`.
- String fields are trimmed.
- Missing name or category fails validation.
- Invalid date, timestamp, currency, price, or warranty month values fail validation.
- Purchase price without currency fails validation.
- Deleted status without `deletedAt` fails validation.
- Non-deleted status with `deletedAt` fails validation.
- CLI supports `inventory item validate --name ... --category ...`.
- CLI JSON output is stable for agent integration.

