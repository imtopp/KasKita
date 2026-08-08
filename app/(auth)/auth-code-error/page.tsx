import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AuthCodeErrorPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Link tidak valid</CardTitle>
        <CardDescription>
          Link ini sudah tidak berlaku atau tidak valid. Silakan coba lagi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/login" className="w-full">
          <Button className="h-11 w-full text-base">Ke halaman masuk</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
