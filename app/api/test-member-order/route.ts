import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const OWNER_EMAIL = "lovemk0618@naver.com";

function J(data:any,status=200){
  return NextResponse.json(data,{
    status,
    headers:{"Cache-Control":"no-store, no-cache, must-revalidate"}
  });
}

function admin(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw new Error("MISSING_SUPABASE_ENV");
  return createClient(url,key,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
}

export async function GET(){
  return J({
    ok:true,
    route:"test-member-order",
    message:"POST only",
    mode:"owner_kakao_free_test"
  });
}

export async function POST(req:Request){
  try{
    const authHeader=req.headers.get("authorization")||"";
    const accessToken=authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if(!accessToken) return J({ok:false,error:"LOGIN_REQUIRED"},401);

    const body=await req.json().catch(()=>null);
    if(!body) return J({ok:false,error:"INVALID_JSON"},400);

    const sb=admin();

    const {data:userData,error:userError}=await sb.auth.getUser(accessToken);
    const user=userData?.user;

    if(userError||!user){
      return J({ok:false,error:"INVALID_SESSION",detail:userError?.message},401);
    }

    const email=String(user.email||"").toLowerCase();
    const provider=String(user.app_metadata?.provider||"");

    // 대표 본인 카카오 계정만 0원 회원 테스트 허용
    if(email!==OWNER_EMAIL || provider!=="kakao"){
      return J({
        ok:false,
        error:"OWNER_KAKAO_TEST_ONLY",
        detail:"이 0원 테스트는 대표자 카카오 테스트 계정에서만 사용할 수 있습니다."
      },403);
    }

    const productName=String(body.product_name||"").trim();
    if(!productName) return J({ok:false,error:"PRODUCT_REQUIRED"},400);

    const {data:product,error:productError}=await sb
      .from("products")
      .select("id,name,slug,price_krw,report_type,is_active")
      .eq("name",productName)
      .eq("is_active",true)
      .maybeSingle();

    if(productError) return J({ok:false,error:"PRODUCT_LOOKUP_FAILED",detail:productError.message},500);
    if(!product) return J({ok:false,error:"PRODUCT_NOT_FOUND",detail:productName},404);

    const input=body.input||{};
    const merchantUid=
      "TEST_MEMBER_"+Date.now()+"_"+Math.random().toString(16).slice(2,10);

    const {data:order,error:orderError}=await sb
      .from("orders")
      .insert({
        user_id:user.id,
        product_id:product.id,
        birth_profile_id:body.birth_profile_id||null,
        question_id:body.question_id||null,
        merchant_uid:merchantUid,
        pg_provider:"TEST_MEMBER_FREE",
        pg_payment_id:null,
        amount_krw:product.price_krw,
        status:"paid",
        paid_at:new Date().toISOString(),
        guest_email:null,
        payment_payload:{
          test_mode:true,
          member_test:true,
          owner_kakao_test:true,
          charged_amount_krw:0,
          listed_amount_krw:product.price_krw,
          guest_input:input,
          auth_provider:"kakao",
          auth_email:email,
          note:"Owner Kakao member free-flow test. No PG payment requested."
        }
      })
      .select("id,merchant_uid,guest_access_token,amount_krw,status,created_at")
      .single();

    if(orderError||!order){
      return J({
        ok:false,
        error:"ORDER_CREATE_FAILED",
        detail:orderError?.message||"No order returned"
      },500);
    }

    return J({
      ok:true,
      test_mode:true,
      member_test:true,
      charged_amount_krw:0,
      listed_amount_krw:order.amount_krw,
      order_id:order.id,
      merchant_uid:order.merchant_uid,
      guest_token:order.guest_access_token,
      status:order.status,
      product:{
        id:product.id,
        name:product.name,
        slug:product.slug
      }
    });
  }catch(e:any){
    console.error("TEST_MEMBER_ORDER_ERROR",e);
    return J({
      ok:false,
      error:"SERVER_ERROR",
      detail:e?.message||String(e)
    },500);
  }
}
