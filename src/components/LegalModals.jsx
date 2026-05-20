import { useEffect } from 'react'

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

function LegalModal({ title, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', handler) }
  }, [onClose])

  return (
    <div className="legal-overlay" onClick={onClose}>
      <div className="legal-modal" onClick={e => e.stopPropagation()}>
        <div className="legal-modal-header">
          <h2 className="legal-modal-title">{title}</h2>
          <button className="legal-modal-close" onClick={onClose} aria-label="Close"><CloseIcon/></button>
        </div>
        <div className="legal-modal-body">{children}</div>
        <div className="legal-modal-footer">
          <button className="legal-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

/* ── Section helpers ─────────────────────────────────────── */
const Sec = ({ title, children }) => (
  <div className="legal-sec">
    <h3 className="legal-sec-title">{title}</h3>
    {children}
  </div>
)
const P = ({ children }) => <p className="legal-p">{children}</p>
const UL = ({ items }) => (
  <ul className="legal-ul">
    {items.map((i, n) => <li key={n}>{i}</li>)}
  </ul>
)

/* ═══════════════════════════════════════════════════════════
   PRIVACY POLICY
   ═══════════════════════════════════════════════════════════ */
export function PrivacyPolicyModal({ onClose }) {
  return (
    <LegalModal title="Privacy Policy" onClose={onClose}>
      <p className="legal-effective">Effective Date: January 1, 2025 &nbsp;|&nbsp; Last Updated: May 2026</p>

      <P>
        [BANK NAME] ("we," "our," or "us") is committed to protecting your personal information. This Privacy Policy
        explains how we collect, use, disclose, and safeguard your information when you use our digital banking platform,
        website, and related services (collectively, the "Services"). Please read this policy carefully. By using our
        Services, you agree to the practices described herein.
      </P>

      <Sec title="1. Information We Collect">
        <P>We collect several types of information to provide and improve our Services:</P>
        <p className="legal-sub-heading">a) Personal Identification Information</p>
        <UL items={[
          'Full legal name, date of birth, and government-issued ID details',
          'Email address, phone number, and mailing address',
          'Social Security Number or Tax Identification Number (for compliance purposes)',
          'Profile photograph uploaded during onboarding',
        ]}/>
        <p className="legal-sub-heading">b) Financial Information</p>
        <UL items={[
          'Account balances, transaction history, and payment records',
          'Linked external bank account details and routing numbers',
          'IBAN, SWIFT/BIC codes for international transfers',
          'Investment portfolio data and trading activity',
        ]}/>
        <p className="legal-sub-heading">c) Technical & Usage Data</p>
        <UL items={[
          'IP address, browser type, device identifiers, and operating system',
          'Pages visited, features used, session duration, and click patterns',
          'Geolocation data (with your consent) for fraud detection',
          'Log files and error reports generated during your sessions',
        ]}/>
      </Sec>

      <Sec title="2. How We Use Your Information">
        <P>We use the information we collect for the following purposes:</P>
        <UL items={[
          'To create, verify, and manage your account securely',
          'To process transactions, transfers, and payments you initiate',
          'To comply with Know Your Customer (KYC) and Anti-Money Laundering (AML) regulations',
          'To detect, investigate, and prevent fraudulent transactions and unauthorized access',
          'To send account alerts, transaction confirmations, and security notifications',
          'To provide customer support and respond to your inquiries',
          'To analyze usage patterns and improve our platform\'s features and performance',
          'To send promotional communications (only with your explicit consent)',
          'To meet our legal and regulatory obligations under applicable financial laws',
        ]}/>
      </Sec>

      <Sec title="3. Information Sharing & Disclosure">
        <P>
          We do not sell, rent, or trade your personal information to third parties for marketing purposes.
          We may share your information only in the following circumstances:
        </P>
        <UL items={[
          'Service Providers: Trusted third-party vendors who assist in operating our platform (cloud hosting, identity verification, fraud detection) under strict confidentiality agreements',
          'Regulatory Bodies: Financial regulators, law enforcement, or government agencies when required by law, court order, or subpoena',
          'Financial Network Partners: Correspondent banks, payment processors, and clearinghouses necessary to execute your transactions',
          'Business Transfers: In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction',
          'With Your Consent: Any other third party with your explicit, prior written consent',
        ]}/>
      </Sec>

      <Sec title="4. Data Security">
        <P>
          We implement industry-leading security measures to protect your personal and financial data at all times:
        </P>
        <UL items={[
          '256-bit SSL/TLS encryption for all data in transit',
          'AES-256 encryption for sensitive data stored at rest',
          'Multi-factor authentication (2FA) enforced for all account access',
          'Regular independent security audits and penetration testing',
          'Real-time fraud monitoring and anomaly detection systems',
          'Strict role-based internal access controls limiting employee data access',
          'Automatic session expiration after periods of inactivity',
        ]}/>
        <P>
          While we take every precaution to protect your information, no method of electronic transmission or
          storage is 100% secure. We encourage you to use strong, unique passwords and enable all available
          security features on your account.
        </P>
      </Sec>

      <Sec title="5. Data Retention">
        <P>
          We retain your personal information for as long as your account is active or as required by law.
          Financial transaction records are retained for a minimum of seven (7) years as required by federal
          banking regulations. Upon account closure, we will delete or anonymize your personal data within
          90 days, except where retention is required by applicable law.
        </P>
      </Sec>

      <Sec title="6. Your Privacy Rights">
        <P>Depending on your jurisdiction, you may have the following rights regarding your personal data:</P>
        <UL items={[
          'Access: Request a copy of the personal data we hold about you',
          'Correction: Request correction of inaccurate or incomplete information',
          'Deletion: Request erasure of your personal data, subject to legal retention requirements',
          'Portability: Receive your data in a structured, machine-readable format',
          'Objection: Object to processing of your data for certain purposes',
          'Withdrawal of Consent: Withdraw consent for optional data processing at any time',
          'Complaint: Lodge a complaint with your local data protection authority',
        ]}/>
        <P>To exercise any of these rights, please contact our Privacy Team at privacy@[bankname].com.</P>
      </Sec>

      <Sec title="7. Children's Privacy">
        <P>
          Our Services are not directed to individuals under the age of 18. We do not knowingly collect
          personal information from minors. If we discover that a minor has provided us with personal data,
          we will promptly delete it. If you believe we have inadvertently collected data from a minor,
          please contact us immediately.
        </P>
      </Sec>

      <Sec title="8. International Data Transfers">
        <P>
          Your information may be stored and processed in countries other than your own. When transferring
          data internationally, we ensure appropriate safeguards are in place, including Standard Contractual
          Clauses approved by relevant data protection authorities.
        </P>
      </Sec>

      <Sec title="9. Changes to This Policy">
        <P>
          We may update this Privacy Policy periodically. We will notify you of material changes by email
          or through a prominent notice on our platform at least 30 days before the changes take effect.
          Your continued use of our Services after such notification constitutes acceptance of the updated policy.
        </P>
      </Sec>

      <Sec title="10. Contact Us">
        <P>For privacy-related questions or to exercise your rights, please contact:</P>
        <P>
          <strong style={{color:'#93c5fd'}}>Privacy Officer</strong><br/>
          [BANK NAME]<br/>
          Email: privacy@[bankname].com<br/>
          Phone: 1-800-555-0100<br/>
          Response time: Within 30 business days
        </P>
      </Sec>
    </LegalModal>
  )
}

/* ═══════════════════════════════════════════════════════════
   TERMS OF SERVICE
   ═══════════════════════════════════════════════════════════ */
export function TermsOfServiceModal({ onClose }) {
  return (
    <LegalModal title="Terms of Service" onClose={onClose}>
      <p className="legal-effective">Effective Date: January 1, 2025 &nbsp;|&nbsp; Last Updated: May 2026</p>

      <P>
        Please read these Terms of Service ("Terms") carefully before using the [BANK NAME] digital banking
        platform and related services. By creating an account or using our Services, you confirm that you have
        read, understood, and agree to be bound by these Terms and our Privacy Policy.
      </P>

      <Sec title="1. Eligibility & Account Registration">
        <P>To use our Services, you must:</P>
        <UL items={[
          'Be at least 18 years of age (or the legal age of majority in your jurisdiction)',
          'Be a legal resident or citizen of a country where our Services are available',
          'Provide accurate, current, and complete information during registration',
          'Maintain the accuracy of your account information at all times',
          'Not have been previously banned or suspended from our platform',
          'Agree to complete identity verification (KYC) as required by applicable law',
        ]}/>
        <P>
          You are responsible for maintaining the confidentiality of your account credentials,
          including your password, PIN, and 2FA codes. You agree to notify us immediately at
          security@[bankname].com if you suspect any unauthorized access to your account.
        </P>
      </Sec>

      <Sec title="2. Description of Services">
        <P>
          [BANK NAME] provides a digital banking platform offering the following financial services,
          subject to eligibility and verification:
        </P>
        <UL items={[
          'Checking and savings accounts with real-time balance tracking',
          'Domestic and international fund transfers (ACH, wire, SWIFT)',
          'Bill payment and scheduled payment services',
          'Debit card issuance and management (virtual and physical)',
          'Foreign currency exchange at competitive live rates',
          'Investment services including stocks, ETFs, and digital assets',
          'AI-powered financial support and account management tools',
        ]}/>
        <P>
          We reserve the right to modify, suspend, or discontinue any service feature at any time
          with reasonable notice. We are not liable for service interruptions caused by factors
          outside our reasonable control.
        </P>
      </Sec>

      <Sec title="3. Financial Terms & Fees">
        <P>
          Current fee schedules for all services are available in your account dashboard under
          "Account Information." Fees may include:
        </P>
        <UL items={[
          'International wire transfer fees: Flat rate per transaction (see fee schedule)',
          'Foreign exchange conversion: Competitive spread applied to live market rate',
          'Expedited transfer fees: For same-day or next-business-day processing',
          'Card replacement fees: For lost, stolen, or damaged cards',
          'Inactivity fees: Applied to dormant accounts after 12 months of inactivity',
        ]}/>
        <P>
          All fees are disclosed before transaction completion. We will provide at least 30 days
          notice before implementing new fees or increasing existing fees.
        </P>
      </Sec>

      <Sec title="4. Prohibited Activities">
        <P>You agree not to use our Services for any of the following:</P>
        <UL items={[
          'Money laundering, terrorist financing, or any activity that violates the Bank Secrecy Act',
          'Fraudulent transactions, including unauthorized use of third-party payment credentials',
          'Processing payments for illegal goods, services, or activities',
          'Circumventing transaction limits, account restrictions, or security controls',
          'Providing false or misleading information during account registration or verification',
          'Engaging in any activity that disrupts, overloads, or impairs our systems',
          'Attempting to reverse-engineer, hack, or exploit our platform or its security features',
          'Creating multiple accounts to circumvent restrictions applied to a single account',
        ]}/>
        <P>
          Violation of these prohibitions may result in immediate account suspension, termination,
          reporting to law enforcement, and recovery of damages to the fullest extent permitted by law.
        </P>
      </Sec>

      <Sec title="5. Transaction Authorization & Liability">
        <P>
          You authorize [BANK NAME] to execute transactions that you initiate through our platform.
          All transactions are final once confirmed unless otherwise specified. You are responsible for:
        </P>
        <UL items={[
          'Verifying all transaction details (amount, recipient, account number) before confirmation',
          'Ensuring sufficient funds are available to cover transactions and applicable fees',
          'Reporting any unauthorized transactions within 60 days of the transaction date',
          'Cooperating fully with fraud investigations initiated on your behalf',
        ]}/>
      </Sec>

      <Sec title="6. Limitation of Liability">
        <P>
          To the maximum extent permitted by applicable law, [BANK NAME] shall not be liable for
          any indirect, incidental, special, consequential, or punitive damages arising from your
          use of our Services, including but not limited to loss of profits, data, or business
          opportunities. Our total liability for any claim shall not exceed the amount of fees paid
          by you in the 12 months preceding the event giving rise to the claim.
        </P>
      </Sec>

      <Sec title="7. Intellectual Property">
        <P>
          All content, features, and functionality of our platform — including software, design,
          text, graphics, logos, and trademarks — are owned exclusively by [BANK NAME] and protected
          by applicable intellectual property laws. You may not reproduce, distribute, or create
          derivative works without our express written consent.
        </P>
      </Sec>

      <Sec title="8. Account Termination">
        <P>
          Either party may terminate the account relationship at any time. Upon termination:
        </P>
        <UL items={[
          'You will have 30 days to withdraw any remaining balance',
          'Pending transactions will be completed or reversed as appropriate',
          'We will retain records as required by applicable law',
          'Any outstanding fees will be deducted from your balance before final disbursement',
        ]}/>
        <P>
          We reserve the right to terminate accounts immediately without notice in cases of fraud,
          illegal activity, or material breach of these Terms.
        </P>
      </Sec>

      <Sec title="9. Governing Law & Dispute Resolution">
        <P>
          These Terms are governed by the laws of the United States. Any disputes arising from or
          relating to these Terms or our Services will be resolved through binding arbitration in
          accordance with the rules of the American Arbitration Association, except where prohibited
          by law. You waive your right to participate in class action lawsuits.
        </P>
      </Sec>

      <Sec title="10. Contact">
        <P>
          For questions regarding these Terms, please contact our Legal Department at
          legal@[bankname].com or 1-800-555-0100.
        </P>
      </Sec>
    </LegalModal>
  )
}

/* ═══════════════════════════════════════════════════════════
   COOKIE POLICY
   ═══════════════════════════════════════════════════════════ */
export function CookiePolicyModal({ onClose }) {
  return (
    <LegalModal title="Cookie Policy" onClose={onClose}>
      <p className="legal-effective">Effective Date: January 1, 2025 &nbsp;|&nbsp; Last Updated: May 2026</p>

      <P>
        This Cookie Policy explains how [BANK NAME] uses cookies and similar tracking technologies
        on our digital banking platform. We are committed to being transparent about how we collect
        and use data, and this policy gives you clear information about your choices.
      </P>

      <Sec title="1. What Are Cookies?">
        <P>
          Cookies are small text files placed on your device (computer, tablet, or smartphone) when
          you visit our website or use our application. They allow our platform to remember your
          preferences, maintain your session security, and deliver a personalized, efficient
          banking experience. Cookies cannot execute programs or deliver viruses to your device.
        </P>
      </Sec>

      <Sec title="2. Types of Cookies We Use">
        <p className="legal-sub-heading">Essential Cookies (Always Active)</p>
        <P>
          These cookies are strictly necessary for our platform to function securely. They cannot
          be disabled without severely affecting how the service works. They include:
        </P>
        <UL items={[
          'Session authentication tokens — keep you securely logged in during your session',
          'CSRF protection tokens — prevent cross-site request forgery attacks',
          'Load balancer cookies — ensure consistent server connection during your session',
          'Security event cookies — detect and respond to suspicious login activity in real time',
        ]}/>

        <p className="legal-sub-heading">Functional Cookies</p>
        <P>These cookies enhance your experience by remembering your choices:</P>
        <UL items={[
          'Language and regional preferences (currency display, date formats)',
          'Theme preference (dark or light mode)',
          'Dashboard layout and widget configuration',
          'Notification and alert preferences',
        ]}/>

        <p className="legal-sub-heading">Analytics Cookies</p>
        <P>
          These help us understand how users interact with our platform so we can improve it.
          All analytics data is aggregated and anonymized:
        </P>
        <UL items={[
          'Pages visited and time spent on each feature',
          'Transaction flow completion rates and drop-off points',
          'Feature usage frequency and navigation patterns',
          'Performance metrics (page load times, error rates)',
        ]}/>

        <p className="legal-sub-heading">Security & Fraud Prevention Cookies</p>
        <P>
          Used exclusively to protect our customers and the integrity of the platform:
        </P>
        <UL items={[
          'Device fingerprinting for trusted device recognition',
          'Behavioral biometrics for continuous authentication',
          'Geolocation anomaly detection cookies',
          'Bot detection and challenge-response verification',
        ]}/>
      </Sec>

      <Sec title="3. Third-Party Cookies">
        <P>
          We use a limited number of trusted third-party services that may set their own cookies.
          These include identity verification partners, fraud detection services, and analytics
          providers. All third-party providers are contractually required to handle data in
          accordance with our Privacy Policy and applicable data protection laws.
        </P>
        <P>
          We do not permit third-party advertising cookies or any tracking for marketing retargeting
          purposes on our banking platform.
        </P>
      </Sec>

      <Sec title="4. How Long Cookies Are Stored">
        <UL items={[
          'Session cookies: Deleted automatically when you close your browser or log out',
          'Functional preference cookies: Stored for up to 12 months',
          'Analytics cookies: Stored for up to 24 months, then automatically deleted',
          'Security cookies: Duration varies based on the security event; typically 30–90 days',
        ]}/>
      </Sec>

      <Sec title="5. Managing Your Cookie Preferences">
        <P>
          You have control over which non-essential cookies are stored on your device:
        </P>
        <UL items={[
          'Browser Settings: Most browsers allow you to block or delete cookies through their settings menu',
          'Account Settings: Manage functional and analytics cookies directly in your profile settings',
          'Opt-Out Tools: Use platform-wide opt-out options for analytics tracking in your dashboard',
        ]}/>
        <P>
          Please note that disabling essential cookies will prevent you from using core banking features,
          including secure login and transaction processing. We recommend keeping essential cookies enabled
          at all times for the security of your account.
        </P>
      </Sec>

      <Sec title="6. Updates to This Policy">
        <P>
          We may update this Cookie Policy when we introduce new features or third-party services.
          We will notify you of significant changes via in-app notification or email. Your continued
          use of our Services following notification constitutes acceptance of the updated policy.
          For questions, contact us at privacy@[bankname].com.
        </P>
      </Sec>
    </LegalModal>
  )
}

/* ═══════════════════════════════════════════════════════════
   COMPLIANCE
   ═══════════════════════════════════════════════════════════ */
export function ComplianceModal({ onClose }) {
  return (
    <LegalModal title="Compliance & Regulatory Framework" onClose={onClose}>
      <p className="legal-effective">Last Updated: May 2026</p>

      <P>
        [BANK NAME] operates with a deep commitment to legal compliance, financial integrity, and
        the highest standards of responsible banking. This page outlines the regulatory frameworks
        we operate within and our obligations to our customers, regulators, and the broader
        financial system.
      </P>

      <Sec title="1. Regulatory Overview">
        <P>
          [BANK NAME] is committed to complying with all applicable federal, state, and international
          financial regulations, including but not limited to:
        </P>
        <UL items={[
          'Bank Secrecy Act (BSA) — Anti-money laundering reporting and recordkeeping',
          'USA PATRIOT Act — Customer identification and verification requirements',
          'Gramm-Leach-Bliley Act (GLBA) — Customer financial data privacy protections',
          'Electronic Fund Transfer Act (EFTA) — Consumer protections for electronic payments',
          'Truth in Savings Act — Transparent disclosure of account terms and fees',
          'Fair Credit Reporting Act (FCRA) — Responsible use of consumer credit information',
          'General Data Protection Regulation (GDPR) — Data rights for EU residents',
          'California Consumer Privacy Act (CCPA) — Privacy rights for California residents',
        ]}/>
      </Sec>

      <Sec title="2. Know Your Customer (KYC) Program">
        <P>
          As part of our commitment to preventing financial crime, we require all customers to
          complete identity verification before accessing full account features. Our KYC program includes:
        </P>
        <UL items={[
          'Government-issued photo ID verification (passport, driver\'s license, national ID)',
          'Proof of address documentation for high-value account tiers',
          'Date of birth verification and sanctions screening',
          'Ongoing customer due diligence and periodic account reviews',
          'Enhanced due diligence for politically exposed persons (PEPs) and high-risk customers',
        ]}/>
        <P>
          We use industry-leading identity verification technology to perform these checks
          efficiently while protecting your personal data throughout the process.
        </P>
      </Sec>

      <Sec title="3. Anti-Money Laundering (AML) Policy">
        <P>
          [BANK NAME] maintains a robust AML compliance program designed to detect, prevent, and
          report suspicious financial activity. Our program includes:
        </P>
        <UL items={[
          'Real-time transaction monitoring using advanced pattern detection algorithms',
          'Automated screening against OFAC, UN, EU, and other international sanctions lists',
          'Suspicious Activity Report (SAR) filing with FinCEN where required',
          'Currency Transaction Reports (CTRs) for cash transactions exceeding $10,000',
          'Staff training on AML/CFT red flags and reporting obligations',
          'Independent third-party AML audits conducted annually',
        ]}/>
      </Sec>

      <Sec title="4. Fraud Prevention & Consumer Protection">
        <P>Our multi-layered fraud prevention framework protects customers at every touchpoint:</P>
        <UL items={[
          'Real-time AI-powered fraud scoring on all transactions',
          'Zero-liability protection for unauthorized transactions reported promptly',
          '24/7 fraud monitoring with automatic account alerts',
          'Biometric authentication options (Face ID, fingerprint) for all sensitive actions',
          'Device trust management and new device verification via OTP',
          'Dedicated fraud investigation team with 48-hour resolution target',
        ]}/>
      </Sec>

      <Sec title="5. Data Protection Compliance">
        <P>
          Our data protection practices are aligned with global standards:
        </P>
        <UL items={[
          'Appointed Data Protection Officer (DPO) overseeing all data handling practices',
          'Data Protection Impact Assessments (DPIAs) conducted for all new features',
          'Regular staff training on data protection obligations and best practices',
          'Documented data processing activities maintained in accordance with GDPR Article 30',
          'Data breach notification procedures: Affected customers notified within 72 hours',
          'Third-party vendor due diligence and Data Processing Agreements (DPAs) in place',
        ]}/>
      </Sec>

      <Sec title="6. Transaction Limits & Controls">
        <P>
          To protect our customers and comply with regulatory requirements, the following
          transaction limits apply by default (adjustable through account settings with verification):
        </P>
        <UL items={[
          'Daily domestic transfer limit: $25,000 (Standard) / $100,000 (Verified Plus)',
          'Daily international wire limit: $10,000 (Standard) / $50,000 (Verified Plus)',
          'Card daily spending limit: $5,000 (Standard) / $20,000 (Premium)',
          'ATM daily withdrawal limit: $1,000 (Standard) / $3,000 (Premium)',
        ]}/>
      </Sec>

      <Sec title="7. Reporting Compliance Concerns">
        <P>
          We encourage all customers and employees to report compliance concerns without fear
          of retaliation. Reports may be made through:
        </P>
        <UL items={[
          'Email: compliance@[bankname].com (monitored by Chief Compliance Officer)',
          'Anonymous hotline: Available through your account dashboard under "Report a Concern"',
          'External reporting: FinCEN Tips at fincen.gov/contact, or your local financial regulator',
        ]}/>
        <P>
          All compliance reports are treated confidentially and investigated promptly
          by our independent compliance team.
        </P>
      </Sec>

      <Sec title="8. Accessibility & Non-Discrimination">
        <P>
          [BANK NAME] is committed to providing equal access to banking services regardless of
          race, color, religion, national origin, sex, disability, or age, in compliance with
          the Equal Credit Opportunity Act and the Americans with Disabilities Act. Our platform
          is designed to meet WCAG 2.1 AA accessibility standards.
        </P>
      </Sec>
    </LegalModal>
  )
}
