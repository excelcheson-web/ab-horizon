# TD Bank App Improvements

## Tasks

### 1. Account Suspension Warning Timing
- [x] Move suspension check to AFTER OTP verification in LocalTransfer.jsx
- [x] Move suspension check to AFTER OTP verification in InternationalTransfer.jsx
- [x] Suspension warning should appear when user clicks "Confirm Transfer" after OTP, not before

### 2. Admin Panel Features ✅ COMPLETED
- [x] Transaction history editing with working UI (modal)
- [x] Auto-generate transactions with edit capability
- [x] Profile picture management with FILE UPLOAD (not just URL)
- [x] Email dropdown for user selection

### 3. Bank Statement Styling
- [ ] Ensure all incoming transactions show + prefix and green color
- [ ] Ensure all outgoing transactions show - prefix and red color
- [ ] Apply styling to TransactionHistory.jsx

### 4. Profile Picture Management (User Side)
- [ ] Add feature to change profile picture in AccountInfo.jsx
- [ ] Add feature to delete profile picture
- [ ] Store profile picture in Firebase/localStorage

### 5. Account Type Display
- [ ] Show chosen account type on Dashboard instead of "Current Account"
- [ ] Update Dashboard.jsx to display correct account type from user profile

## Admin Panel Features Summary (COMPLETED)

### Transaction History Editing
- Edit button (✏️) for each transaction in history table
- Full-featured edit modal with all transaction fields
- Supports editing: type, direction, beneficiary, amount, bank, date, account number
- International transfer fields (IBAN, SWIFT, country) conditionally shown
- Save/Cancel functionality with proper state management
- Auto-refreshes transaction list after save

### Auto-Generate Transactions
- "Auto-Generate Transactions" section in Transaction History tab
- Configurable: number of transactions (1-50), min/max amount, date range
- Generates realistic random data with various beneficiaries and banks
- Supports local, international, and credit transaction types
- Shows loading spinner during generation
- Auto-refreshes transaction list after generation

### Profile Picture File Upload
- "Choose File" button for image upload with FileReader
- Accepts all image types, converts to base64 data URL
- URL input still supported as alternative
- Preview of selected file/URL shown
- Update and Remove buttons for managing profile picture

### Email Dropdown
- `<datalist>` element with all user emails for search/select
- Shows user name alongside email in dropdown
- "Refresh Users" button to reload user list

## Testing Checklist
- [x] Test suspension warning appears after OTP verification
- [x] Test admin panel user switching
- [x] Test transaction editing in admin panel
- [x] Test auto-generate transactions
- [x] Test profile picture file upload in admin panel
- [ ] Test transaction colors in statement
- [ ] Test profile picture upload/delete (user side)
- [ ] Test account type display on dashboard

