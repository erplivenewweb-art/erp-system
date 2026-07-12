import type { Metadata } from "next"; import { BulkOrderPage } from "@/features/bulk-order";
export const metadata:Metadata={title:"Bulk order preview",description:"Static dealer bulk-enquiry table.",robots:{index:false,follow:false}}; export default function Page(){return <BulkOrderPage/>;}
