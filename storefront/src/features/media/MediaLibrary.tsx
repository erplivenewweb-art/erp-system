import { MediaCMSProvider } from "@/features/media-cms-simulation/MediaCMSProvider";
import { MediaLibraryManager } from "@/features/media-cms-simulation/MediaLibraryManager";

/** Compatibility wrapper for isolated component tests. The application route
 * uses the root-scoped provider directly so live synchronization is shared. */
export function MediaLibrary() {
  return (
    <MediaCMSProvider enabled>
      <MediaLibraryManager />
    </MediaCMSProvider>
  );
}
