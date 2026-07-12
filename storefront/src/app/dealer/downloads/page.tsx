import type { Metadata } from "next"; import { DealerDownloads } from "@/features/dealer";
export const metadata:Metadata={title:"Dealer downloads preview",description:"Static resource placeholders without files.",robots:{index:false,follow:false}}; export default function Page(){return <DealerDownloads/>;}
