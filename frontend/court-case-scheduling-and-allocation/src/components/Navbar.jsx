import heroLogo from '../assets/Vigil, logo.png';

export default function Navbar() {
    return (
        <nav className="navbar">
            <div className="navbar-inner">
                <img src={heroLogo} alt="Virtual Court logo" className="navbar-logo" />
                <div className="navbar-text">
                    <h1 className="navbar-title">Vigil</h1>
                    <h2 className="navbar-subtitle">Court Allocation and Scheduling</h2>
                </div>
            </div>
        </nav>
    );
}