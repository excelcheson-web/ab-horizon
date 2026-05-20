import TDLogo from './TDLogo'

export default function VaultLoader({ message = 'Securing your session…' }) {
  return (
    <div className="vault-loader-screen">
      {/* Bank placeholder logo */}
      <div className="vault-logo">
        <TDLogo size={64} />
      </div>
      {/* Spinning vault */}
      <div className="vault">
        <div className="vault-door">
          <div className="vault-ring vault-ring--outer" />
          <div className="vault-ring vault-ring--inner" />
          <div className="vault-handle">
            <div className="vault-spoke" />
            <div className="vault-spoke" />
            <div className="vault-spoke" />
          </div>
          <div className="vault-center" />
        </div>
      </div>
      <p className="vault-message">{message}</p>
      <div className="vault-dots">
        <span /><span /><span />
      </div>
    </div>
  )
}
