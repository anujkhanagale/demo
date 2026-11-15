const designThemes = [
  { name: "Hidden Leaf", colors: ["#092c32", "#11b6a4", "#e7f69a"], motif: "orbit" },
  { name: "Saiyan Voltage", colors: ["#26204b", "#f0a332", "#f6e5a2"], motif: "sunburst" },
  { name: "Grand Line", colors: ["#092b49", "#27a5c3", "#f2d081"], motif: "waves" },
  { name: "Breathing Forms", colors: ["#3c1736", "#ed6688", "#f7e0b0"], motif: "petals" },
  { name: "Cursed Energy", colors: ["#111832", "#7581fa", "#b8ddff"], motif: "sigils" },
  { name: "Wings of Resolve", colors: ["#243a31", "#9ac87d", "#efe2be"], motif: "chevrons" },
  { name: "Shadow Monarch", colors: ["#17182d", "#794ef8", "#a9f6f0"], motif: "shards" },
  { name: "Devil's Pulse", colors: ["#431b21", "#ff594c", "#ffd39b"], motif: "slashes" },
  { name: "Clan Original", colors: ["#162238", "#49a8ec", "#b3e8ff"], motif: "constellation" },
];

const animeCategories = [
  "Naruto",
  "Dragon Ball",
  "One Piece",
  "Demon Slayer",
  "Jujutsu Kaisen",
  "Attack on Titan",
  "Solo Leveling",
  "Chainsaw Man",
  "Custom Designs",
];

export const laptopBaseColors = [
  { name: "Graphite", value: "#343941" },
  { name: "Silver", value: "#aeb7c2" },
  { name: "Midnight", value: "#20233c" },
  { name: "Rose", value: "#b57f80" },
];

export const getLaptopBaseColorName = (value) =>
  laptopBaseColors.find((color) => color.value === value)?.name || value;

function motifArtwork(motif, accent) {
  switch (motif) {
    case "orbit":
      return `<circle cx="710" cy="266" r="152" fill="none" stroke="${accent}" stroke-width="2" opacity=".8"/><circle cx="710" cy="266" r="108" fill="none" stroke="${accent}" stroke-width="1" opacity=".55"/><path d="M470 330 Q704 66 905 250" fill="none" stroke="${accent}" stroke-width="3"/><circle cx="611" cy="198" r="13" fill="${accent}"/>`;
    case "sunburst":
      return `<circle cx="712" cy="282" r="103" fill="none" stroke="${accent}" stroke-width="3"/>${Array.from({ length: 16 }, (_, index) => `<path d="M712 122 L712 68" stroke="${accent}" stroke-width="3" transform="rotate(${index * 22.5} 712 282)" opacity=".72"/>`).join("")}`;
    case "waves":
      return Array.from({ length: 7 }, (_, index) => `<path d="M428 ${200 + index * 36} Q520 ${150 + index * 36} 614 ${200 + index * 36} T800 ${200 + index * 36} T986 ${200 + index * 36}" fill="none" stroke="${accent}" stroke-width="3" opacity="${0.35 + index * 0.07}"/>`).join("");
    case "petals":
      return Array.from({ length: 9 }, (_, index) => `<ellipse cx="700" cy="260" rx="35" ry="134" fill="none" stroke="${accent}" stroke-width="2" transform="rotate(${index * 20} 700 260)" opacity=".72"/>`).join("");
    case "sigils":
      return `<path d="M700 110 L830 310 L700 510 L570 310 Z M700 176 L786 310 L700 444 L614 310 Z" fill="none" stroke="${accent}" stroke-width="3"/><circle cx="700" cy="310" r="24" fill="none" stroke="${accent}" stroke-width="3"/>`;
    case "chevrons":
      return Array.from({ length: 7 }, (_, index) => `<path d="M${560 + index * 32} 155 L${714 + index * 32} 310 L${560 + index * 32} 465" fill="none" stroke="${accent}" stroke-width="3" opacity=".55"/>`).join("");
    case "shards":
      return `<path d="M555 380 L674 111 L704 285 L831 152 L780 428 L694 335 L627 472 Z" fill="${accent}" opacity=".72"/><path d="M592 398 L674 220 L681 310 L767 216 L741 392 L690 345 Z" fill="#121522"/>`;
    case "slashes":
      return Array.from({ length: 8 }, (_, index) => `<path d="M${528 + index * 49} 454 L${663 + index * 49} 146" stroke="${accent}" stroke-width="${index % 2 ? 3 : 7}" opacity=".67"/>`).join("");
    default:
      return `<circle cx="700" cy="275" r="145" fill="none" stroke="${accent}" stroke-width="2"/>${Array.from({ length: 12 }, (_, index) => `<circle cx="${584 + (index * 83) % 244}" cy="${164 + (index * 57) % 229}" r="${index % 3 + 3}" fill="${accent}"/>`).join("")}<path d="M584 164 L667 221 L750 278 L833 335 M667 221 L750 164 L833 221" fill="none" stroke="${accent}" stroke-width="1" opacity=".55"/>`;
  }
}

function svgDataUrl(theme, index) {
  const [base, accent, highlight] = theme.colors;
  const art = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="624" viewBox="0 0 960 624">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset="1" stop-color="#090a12"/></linearGradient>
        <radialGradient id="glow"><stop stop-color="${accent}" stop-opacity=".38"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>
        <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="${highlight}" stroke-opacity=".09"/></pattern>
      </defs>
      <rect width="960" height="624" fill="url(#bg)"/>
      <rect width="960" height="624" fill="url(#glow)"/>
      <rect width="960" height="624" fill="url(#grid)"/>
      <path d="M62 64H324 M62 74H218 M636 550H898 M772 560H898" stroke="${highlight}" stroke-opacity=".42" stroke-width="2"/>
      <path d="M470 0L490 624" stroke="${highlight}" stroke-opacity=".08"/>
      ${motifArtwork(theme.motif, accent)}
      <path d="M0 464C147 401 216 566 375 500s236-86 357-24 154 42 228 8v140H0z" fill="${accent}" opacity=".13"/>
      <path d="M0 520C142 470 241 608 389 550s238-74 359-29 142 44 212 19" fill="none" stroke="${highlight}" stroke-opacity=".52" stroke-width="2"/>
      <rect x="34" y="34" width="892" height="556" rx="16" fill="none" stroke="${highlight}" stroke-opacity=".45" stroke-width="2"/>
      <text x="66" y="123" fill="${highlight}" font-family="Arial,sans-serif" font-size="16" letter-spacing="5">CUSTOM CLANS  /  SKIN ${String(index + 1).padStart(2, "0")}</text>
      <text x="66" y="493" fill="#fffdf4" font-family="Arial,sans-serif" font-size="38" font-weight="700" letter-spacing="3">${theme.name.toUpperCase()}</text>
      <text x="67" y="528" fill="${highlight}" font-family="Arial,sans-serif" font-size="13" letter-spacing="4">ORIGINAL FAN-INSPIRED ARTWORK</text>
    </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(art)}`;
}

const laptopSkins = designThemes.map((theme, index) => ({
  id: index + 1,
  productId: 101 + index,
  category: animeCategories[index],
  name: theme.name,
  price: 1499,
  colors: theme.colors,
  motif: theme.motif,
  artwork: svgDataUrl(theme, index),
}));

export default laptopSkins;

export const laptopSkinProducts = laptopSkins.map((skin) => ({
  productId: skin.productId,
  name: `Laptop Skin — ${skin.name}`,
  price: skin.price,
}));
