# Stocko v9 Daily Assignment History update

- Assignment History now shows one combined table for the selected business date.
- Removed separate OPEN/CLOSED shift cards from the History UI.
- History requires a single date filter and defaults to the current shift business date.
- Developer can see accessible branches together; Branch remains visible as a table column.
- Staff display remains `Name (Branch)` and there is also a dedicated Branch column.
- Time displays as a readable range such as `2:30 AM – 2:45 AM`.
- `shift_id` remains internal so after-midnight tasks remain attached to the business date of the shift that started them.
