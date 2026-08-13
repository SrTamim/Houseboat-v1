# Payment method logos

Drop the official logo files here (SVG preferred, PNG with transparent background is fine).
The footer (`CustomerFooter.tsx`) references these exact filenames:

- `bkash.svg`
- `nagad.svg`
- `upay.svg`
- `tap.svg`
- `visa.svg`
- `mastercard.svg`
- `amex.svg`
- `dbbl.svg`

Each file is a 48×28 SVG that draws its own white rounded card, so the footer
renders them without any extra border or background.

Recommended: ~26px tall render, so export at 2x (≈52px tall) for crispness.
Until a file is added, its `<img>` slot shows the brand name as alt text.
