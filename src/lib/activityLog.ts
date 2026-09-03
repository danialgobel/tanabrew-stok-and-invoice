import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type ActivityAction = "CREATE_PRODUCT" | "UPDATE_PRODUCT" | "DELETE_PRODUCT" | "CREATE_INVOICE" | "PRINT_INVOICE" | "UPDATE_PAYMENT_STATUS" | "OWNER_ANNOUNCEMENT" | "TRANSFER_STOCK";
type ActivityTargetType = "product" | "invoice" | "notification";

interface ActivityLogUser {
  uid: string;
  name: string;
  role: string;
}

interface ActivityLogInput {
  user: ActivityLogUser;
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetId: string;
  targetName: string;
  description: string;
}

export const addActivityLog = async ({
  user,
  action,
  targetType,
  targetId,
  targetName,
  description,
}: ActivityLogInput) => {
  await addDoc(collection(db, "activity_logs"), {
    user_id: user.uid,
    user_name: user.name,
    user_role: user.role,
    action,
    target_type: targetType,
    target_id: targetId,
    target_name: targetName,
    description,
    created_at: serverTimestamp(),
  });
};
