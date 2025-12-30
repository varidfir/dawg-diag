import Image from "next/image";

export default function LogoScroll() {
    const marque = [
      "/marque/intel.svg",
      "/marque/amd.svg",
      "/marque/nvidia.svg",
      "/marque/msi.svg",
      "/marque/lenovo.svg",
      "/marque/gigabyte.svg",
      "/marque/hp.svg",
      "/marque/asus.svg",
      "/marque/sapphire.svg",
      "/marque/powercolor.svg",
    ];    
  
    return (
      <div className="overflow-hidden w-full py-8 bg-gray-200">
        <div className="marquee gap-10">
          {[...marque, ...marque].map((logo, i) => (
            <Image
              key={i}
              src={logo}
              width={100}
              height={100}
              className="text-black dark:text-white h-12 w-auto object-contain opacity-80 hover:opacity-100 transition"
              alt="logo"
            />
          ))}
        </div>
      </div>
    );
  }