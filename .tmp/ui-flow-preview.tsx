import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import '../src/index.css'
import '../src/components/my-pet/PetFlow.css'
import PetMobileFlow from '../src/components/my-pet/PetMobileFlow'
import PetCreateFlow from '../src/components/my-pet/PetCreateFlow'
import DiaryPage from '../src/features/diary/DiaryPage'
import {QnaScreen,QnaCreateFlow} from '../src/components/qna/QnaScreen'
import MapScreen from '../src/components/hospital-map/MapScreen'
import {AppNavigation} from '../src/components/navigation/AppNavigation'
import {animalCategoryOptions,animalCategoryLabels,petSpeciesOptions,CategoryTagIcon} from '../src/components/hospital-map/mapDependencies'
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const now=new Date().toISOString()
const uid='00000000-0000-4000-8000-000000000001'
const pets=[
{id:'00000000-0000-4000-8000-000000000002',name:'청단이',group:'reptile',species:'크레스티드 게코',gender:'male',birthday:'2024-05-01'},
{id:'00000000-0000-4000-8000-000000000003',name:'도담이',group:'reptile',species:'레오파드 게코',gender:'female',birthday:'2024-07-10'}]
const kinds=[['feed','먹이','09:00'],['mist','분무','10:00'],['water','물그릇','11:00'],['humidity','습도','14:00'],['uvb_check','UVB','18:00'],['medicine','약','20:00']]
const plans=kinds.map(([type,title,time],i)=>({id:'plan-'+i,userId:uid,petId:pets[0].id,taskType:type,title,repeatDays:[0,1,2,3,4,5,6],recurrenceType:'weekdays',startDate:today,notificationTime:time,isActive:true,createdAt:now,updatedAt:now}))
const tasks=plans.map((plan,i)=>({id:'task-'+i,userId:uid,petId:plan.petId,carePlanId:plan.id,taskType:plan.taskType,scheduledDate:today,occurrenceNo:1,status:i<2?'completed':'pending',createdAt:now,updatedAt:now}))
const records=[...Array.from({length:5},(_,i)=>({id:'weight-'+i,userId:uid,petId:pets[0].id,type:'weight',weight:25+i*8,date:'2026-09-0'+(i+1),createdAt:now})),{id:'food-record',userId:uid,petId:pets[0].id,type:'food',foods:['귀뚜라미'],memo:'먹이',dailyTaskId:'task-0',date:today,createdAt:now}]
const planRows=plans.map(p=>({id:p.id,user_id:uid,pet_id:p.petId,task_type:p.taskType,title:p.title,repeat_days:p.repeatDays,recurrence_type:p.recurrenceType,start_date:today,notification_time:p.notificationTime,is_active:true,created_at:now,updated_at:now}))
const taskRows=tasks.map(t=>({id:t.id,user_id:uid,pet_id:t.petId,care_plan_id:t.carePlanId,task_type:t.taskType,scheduled_date:today,occurrence_no:1,status:t.status,created_at:now,updated_at:now}))
const recordRows=records.map(r=>({id:r.id,user_id:uid,pet_id:r.petId,record_date:r.date,record_type:r.type,memo:r.memo||'',payload:r,daily_task_id:r.dailyTaskId,status:'manual',created_at:now}))
const realFetch=window.fetch.bind(window)
window.fetch=async(input,init)=>{
const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href)
if(url.hostname===location.hostname)return realFetch(input,init)
if(url.pathname.startsWith('/rest/')||url.pathname.startsWith('/auth/')||url.pathname.startsWith('/functions/')){
const table=url.pathname.split('/').at(-1)
const result=table==='care_plans'?planRows:table==='daily_tasks'?taskRows:table==='care_records'?recordRows:[]
return new Response(JSON.stringify(result),{status:200,headers:{'content-type':'application/json'}})
}
return new Response('[]',{status:200,headers:{'content-type':'application/json'}})
}
const profile={username:'preview',nickname:'집사',avatarUrl:''}
const posts=[{id:'post-1',title:'도마뱀이 탈피를 잘 못해요',body:'최근 탈피가 잘 안되는데 어떻게 해야 할까요?',author:'게코지킴이',category:'질병',animal:'청단이',petId:pets[0].id,animalGroup:'reptile',animalSpecies:'크레스티드 게코',createdAt:now,likes:12,liked:false,viewCount:120,comments:[]},{id:'post-2',title:'배변 색깔이 이상해요',body:'최근 기록을 함께 확인하고 싶어요.',author:'집사',category:'질병',animal:'도담이',petId:pets[1].id,createdAt:now,likes:2,liked:false,viewCount:54,comments:[]},{id:'post-3',title:'사육장 온도 조절 방법',body:'사육장 환경을 기록하고 있어요.',author:'게코집사',category:'환경',animal:'청단이',petId:pets[0].id,createdAt:now,likes:5,liked:false,viewCount:98,comments:[]}]
function Preview(){
const [screen,setScreen]=useState(new URLSearchParams(location.search).get('screen')||'pets')
const [view,setView]=useState('main');const [selected,setSelected]=useState(pets[0].id);const [qnaPosts,setQnaPosts]=useState(posts)
const go=(next)=>{setScreen(next);setView('main')}
if(screen==='pet-create') return <PetCreateFlow userId={uid} initialPet={null} categoryOptions={animalCategoryOptions.filter(x=>x!=='all')} categoryLabels={animalCategoryLabels} speciesOptions={petSpeciesOptions} renderCategoryIcon={x=><CategoryTagIcon category={x}/>} onClose={()=>go('pets')} onSave={async()=>{}} onOpenPlan={()=>go('diary')}/>
if(screen==='qna-create') return <QnaCreateFlow userId={uid} pets={pets} author="집사" authorAvatarUrl="" onClose={()=>go('qna')} onSave={async post=>{setQnaPosts([post,...qnaPosts]);go('qna')}}/>
return <div className="app-shell"><AppNavigation activeTab={screen} profile={profile} sideNavOpen={false} onOpenMenu={()=>{}} onCloseMenu={()=>{}} onMoveTab={go} onToggleProfile={()=>{}} onBottomPointerDown={()=>{}} onBottomPointerMove={()=>{}} onBottomPointerUp={()=>{}} onBottomPointerCancel={()=>{}} shouldSuppressBottomClick={()=>false}/><div className="app-main">
{screen==='pets'&&<PetMobileFlow pets={pets} selectedPetId={selected} view={view} tasks={tasks} plans={plans} records={records} onSelectPet={setSelected} onView={setView} onRegisterPet={()=>go('pet-create')} onEditPet={()=>go('pet-create')} onDeletePet={async()=>{}} onOpenDiary={()=>go('diary')}/>}
{screen==='diary'&&<DiaryPage userId={uid} pets={pets} hospitals={[]} hospitalReviews={{}} onAddPet={()=>go('pet-create')}/>}
{screen==='qna'&&<QnaScreen userId={uid} profile={profile} posts={qnaPosts} onChange={setQnaPosts} onDeletePost={()=>{}} onEditPost={()=>go('qna-create')} onCreate={()=>go('qna-create')} onOpenHospital={()=>go('map')} onOpenDiary={()=>go('diary')}/>}
{screen==='map'&&<MapScreen userId={uid} profile={profile} pets={pets} reviews={{}} likedHospitals={[]} onReviewsChange={()=>{}} onLikedHospitalsChange={()=>{}}/>}
</div></div>}
createRoot(document.getElementById('root')).render(<Preview/>)

