import type { Metadata } from "next"; import { DealerLogin } from "@/features/dealer";
export const metadata:Metadata={title:"Dealer login preview",description:"Static dealer login shell without authentication.",robots:{index:false,follow:false}}; export default function Page(){return <DealerLogin/>;}
