import logo from '../assets/devlin-property-logo.png';

export default function PrintWatermark() {
  return (
    <div className="print-watermark" aria-hidden="true">
      <img src={logo} alt="" />
    </div>
  );
}
