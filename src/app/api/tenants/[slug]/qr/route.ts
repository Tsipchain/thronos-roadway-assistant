import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "svg"; // svg | png | json
  const baseUrl =
    searchParams.get("base") ??
    process.env.NEXTAUTH_URL ??
    "https://roadway.thronoschain.org";

  const sosUrl = `${baseUrl}/t/${params.slug}`;

  if (format === "json") {
    return NextResponse.json({ url: sosUrl, slug: params.slug });
  }

  if (format === "png") {
    const buf = await QRCode.toBuffer(sosUrl, {
      type: "png",
      width: 512,
      margin: 2,
      color: { dark: "#1e1b4b", light: "#ffffff" },
    });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="sos-${params.slug}.png"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // default: SVG
  const svg = await QRCode.toString(sosUrl, {
    type: "svg",
    width: 256,
    margin: 2,
    color: { dark: "#1e1b4b", light: "#ffffff" },
  });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
