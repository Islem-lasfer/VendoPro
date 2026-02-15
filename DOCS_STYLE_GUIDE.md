DOCS STYLE GUIDE — Tone: Formal / Administrative

Purpose
- Standardize wording, labels and layout used in customer-facing documents (factures, bons de commande, fiches de paie, certificats de garantie).

Tone & register
- Formal, administrative, impersonal.
- Use full words ("Société", "Facture", "Client") and neutral phrasing.
- Avoid marketing language on legal documents.

Terminology (FR)
- Invoice = `Facture`
- Purchase order = `Bon de commande`
- Payslip = `Fiche de paie`
- Warranty certificate = `Certificat de garantie`
- Company = `Société` / `Entreprise`
- Client / Customer = `Client`

Formatting rules
- Date format: DD/MM/YYYY (ex: 15/02/2026)
- Currency: use space as thousands separator + symbol after amount (ex: 1 234,56 €)
- Numbers: use two decimals for monetary values
- Headings: Title (uppercase), section headers sentence-case
- Use placeholders in templates: `[NOM DE L'ENTREPRISE]`, `[SIRET]`, `[NOM CLIENT]`, etc.

Mandatory document blocks
1. Header: Document title, document number, date d'émission
2. Seller (company) block: Name, adresse, SIRET, TVA intracom., contact (phone/email), IBAN (optional)
3. Client block: Name, adresse, identification (SIRET/N° if applicable)
4. Items table: Désignation | Quantité | Prix unit. | Total
5. Totals: Montant HT | TVA (x%) | Montant TTC
6. Conditions: payment terms and delivery/return policy
7. Signature: "Signature et cachet" block
8. Footer: legal identifiers and contact (SIRET, TVA intracom., email)

Recommended legal snippets (FR)
- Payment terms: "Paiement à réception — Net à 30 jours. En cas de retard, pénalités conformes à la réglementation en vigueur."
- Confidentiality (payslip): "Document confidentiel — réservé au destinataire. Conserver comme justificatif de rémunération."

Developer notes
- Use `doc.splitTextToSize()` when writing long legal paragraphs to avoid overflow.
- Keep template placeholders clearly marked and easy to replace programmatically.
- All translations must preserve legal terms consistently across languages.

Examples
- See `pdf/facture.js`, `pdf/bon de command.js`, `pdf/fiche-de-paie.js`, `pdf/garantie.js` for canonical templates.

Change process
- For document wording changes, update the template + `DOCS_STYLE_GUIDE.md` and open a PR describing the legal/content change.

Contact
- For legal wording review, consult your legal advisor before publishing templates used for invoicing or payroll.