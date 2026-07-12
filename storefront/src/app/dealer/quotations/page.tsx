import type { Metadata } from "next"; import { QuotationCenter } from "@/features/quotation";
export const metadata:Metadata={title:"Quotation centre preview",description:"Static dealer quotation UI.",robots:{index:false,follow:false}}; export default function Page(){return <QuotationCenter/>;}
