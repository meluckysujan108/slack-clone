import { usePathname } from "next/navigation";

import { Bell, Home, MessagesSquare, MoreHorizontal } from "lucide-react";
import { UserButton } from "@/features/components/user-button";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { useChannelId } from "@/hooks/use-channel-id";

import { WorkspaceSwitcher } from "./workspace-switcher";
import { SidebarButton } from "./sidebar-button";

export const Sidebar = () => {
	const pathname = usePathname();
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	return (
		<aside className="w-[70px] bg-maroon-200 flex flex-col gap-y-4 items-center pt-[9px] pb-4">
			<WorkspaceSwitcher />
			<SidebarButton
				icon={Home}
				label="Home"
				isactive={
					pathname.includes("/workspace") &&
					!pathname.includes("/dms") &&
					!pathname.includes("/activity") &&
					!pathname.includes("/more")
				}
				redirect="/"
			/>
			<SidebarButton
				icon={MessagesSquare}
				label="DMs"
				isactive={pathname.includes("/dms")}
				redirect={`/workspace/${workspaceId}/channel/${channelId}/dms`}
			/>
			<SidebarButton
				icon={Bell}
				label="Activity"
				isactive={pathname.includes("/activity")}
				redirect={`/workspace/${workspaceId}/channel/${channelId}/activity`}
			/>
			<SidebarButton
				icon={MoreHorizontal}
				label="More"
				isactive={pathname.includes("/more")}
				redirect={`/workspace/${workspaceId}/channel/${channelId}/more`}
			/>
			<div className="flex flex-col items-center justify-center gap-y-1 mt-auto">
				<UserButton />
			</div>
		</aside>
	);
};
